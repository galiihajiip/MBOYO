import "server-only";
import type {
  GeminiAdvisoryResponse,
  GeminiImageDisclosureLevel,
  RequestGeminiAdvisoryInput,
} from "@mboyo/domain";
import { GEMINI_ADVISORY_UI_LABEL } from "@mboyo/domain";
import { getServerEnv } from "../../env.server";
import { ApiError } from "../../api/errors";
import {
  GeminiInvalidResponseError,
  GeminiNotConfiguredError,
  GeminiRateLimitedError,
  GeminiTimeoutError,
  requestGeminiAdvisory,
} from "../../gemini/client";
import { redactImage } from "../../gemini/redaction";
import type { ReportsDbClient } from "./types";

/**
 * The Gemini verifier-advisory service — per
 * docs/adr/0004-local-ml-primary-gemini-advisory.md, this function NEVER
 * writes to reports.status or verification_reviews, regardless of the
 * Gemini call's outcome. It only ever calls record_gemini_advisory_request
 * (this block's migration, SECURITY DEFINER, mirrors
 * submit_verification_decision's exact shape) and returns the resulting
 * audit row — the Verifier's own subsequent confirm/override/reject
 * decision is a completely separate action, made through
 * submitVerificationDecision (lib/reports/service/transitions.ts), never
 * triggered or influenced automatically by this function. The RPC
 * resolves the acting Verifier server-side via current_profile_id() —
 * this function never passes a client-controlled profile id.
 */

interface ReportContextRow {
  id: string;
  description: string | null;
}

interface EvidenceRow {
  storage_path: string;
  mime_type: string;
}

interface ModelPredictionRow {
  severity_probabilities: Record<string, number>;
  quality_score: number;
}

interface GeminiAdvisoryRequestRow {
  id: string;
  report_id: string;
  status: "succeeded" | "failed" | "timed_out" | "rate_limited";
  image_disclosure_level: GeminiImageDisclosureLevel;
  structured_output: {
    evidenceSummary: string;
    suggestedFollowUpQuestion: string | null;
    nonBindingHypothesis: string | null;
    qualityObservations: string[];
  } | null;
  error_message: string | null;
  model_name: string;
  latency_ms: number;
  retry_count: number;
  created_at: string;
}

interface PostgrestLikeError {
  code?: string;
  message: string;
}

const INSUFFICIENT_PRIVILEGE_SQLSTATE = "42501";
const NOT_FOUND_SQLSTATE = "P0002";
const INVALID_DISCLOSURE_SQLSTATE = "22023";

function translateRpcError(error: PostgrestLikeError): never {
  if (error.code === INSUFFICIENT_PRIVILEGE_SQLSTATE) {
    throw new ApiError("forbidden", "Anda tidak memiliki izin untuk meminta analisis tambahan eksternal.");
  }
  if (error.code === NOT_FOUND_SQLSTATE) {
    throw new ApiError("not_found", "Laporan tidak ditemukan.");
  }
  if (error.code === INVALID_DISCLOSURE_SQLSTATE) {
    throw new ApiError(
      "forbidden",
      "Foto asli hanya dapat dikirim setelah persetujuan dan pengungkapan eksternal disetujui.",
    );
  }
  throw new ApiError("internal_error", "Gagal menyimpan hasil analisis tambahan eksternal.");
}

function toGeminiAdvisoryResponse(row: GeminiAdvisoryRequestRow): GeminiAdvisoryResponse {
  return {
    id: row.id,
    reportId: row.report_id,
    status: row.status,
    imageDisclosureLevel: row.image_disclosure_level,
    structuredOutput: row.structured_output,
    errorMessage: row.error_message,
    modelName: row.model_name,
    latencyMs: row.latency_ms,
    retryCount: row.retry_count,
    createdAt: row.created_at,
    disclaimerLabel: GEMINI_ADVISORY_UI_LABEL,
  };
}

function topSeverityPrediction(probabilities: Record<string, number>): { label: string; confidence: number } {
  let bestLabel = "unknown";
  let bestConfidence = -1;
  for (const [label, confidence] of Object.entries(probabilities)) {
    if (confidence > bestConfidence) {
      bestLabel = label;
      bestConfidence = confidence;
    }
  }
  return { label: bestLabel, confidence: Math.max(bestConfidence, 0) };
}

async function recordAdvisoryRequest(
  db: ReportsDbClient,
  params: {
    reportId: string;
    status: "succeeded" | "failed" | "timed_out" | "rate_limited";
    imageDisclosureLevel: GeminiImageDisclosureLevel;
    consentAccepted: boolean;
    externalDisclosureAccepted: boolean;
    structuredOutput: object | null;
    errorMessage: string | null;
    modelName: string;
    requestId: string;
    latencyMs: number;
    retryCount: number;
  },
): Promise<GeminiAdvisoryResponse> {
  const { data, error } = await db
    .rpc("record_gemini_advisory_request", {
      p_report_id: params.reportId,
      p_status: params.status,
      p_image_disclosure_level: params.imageDisclosureLevel,
      p_consent_accepted: params.consentAccepted,
      p_external_disclosure_accepted: params.externalDisclosureAccepted,
      p_structured_output: params.structuredOutput,
      p_error_message: params.errorMessage,
      p_model_name: params.modelName,
      p_request_id: params.requestId,
      p_latency_ms: params.latencyMs,
      p_retry_count: params.retryCount,
    })
    .single<GeminiAdvisoryRequestRow>();

  if (error) {
    translateRpcError(error);
  }
  if (!data) {
    throw new ApiError("internal_error", "Gagal menyimpan hasil analisis tambahan eksternal.");
  }

  return toGeminiAdvisoryResponse(data);
}

/**
 * Requests one Gemini advisory for a report, on behalf of the calling
 * Verifier (resolved server-side by the RPC, never passed as an argument
 * here). Every outcome (success, failure, timeout, rate-limit) is
 * recorded as one complete audit row — a failed/timed-out/rate-limited
 * call is not an exception the caller must separately log; it IS the
 * audit trail. Only a genuinely unrecoverable pre-condition (Gemini not
 * configured, RLS-hidden report, no evidence) throws an ApiError before
 * any row is written, since there's nothing meaningful to audit in those
 * cases.
 */
export async function requestGeminiAdvisoryForReport(
  db: ReportsDbClient,
  reportId: string,
  input: RequestGeminiAdvisoryInput,
  requestId: string,
): Promise<GeminiAdvisoryResponse> {
  const env = getServerEnv();

  if (!env.GEMINI_API_KEY) {
    throw new ApiError(
      "precondition_failed",
      "Analisis tambahan eksternal (Gemini) belum diaktifkan pada sistem ini.",
    );
  }

  // Defense-in-depth: requestGeminiAdvisorySchema (packages/domain) and
  // record_gemini_advisory_request() (this block's RPC) both already
  // enforce both acknowledgements before a raw image can be persisted —
  // re-checking here means the raw image is never even DOWNLOADED, let
  // alone sent externally, without both booleans explicitly true, per
  // this block's "raw image sent only when... consent/policy permits, and
  // external-cloud disclosure is accepted" requirement.
  if (input.imageDisclosureLevel === "raw_image") {
    if (!input.consentAccepted || !input.externalDisclosureAccepted) {
      throw new ApiError(
        "forbidden",
        "Foto asli hanya dapat dikirim setelah persetujuan dan pengungkapan eksternal disetujui.",
      );
    }
  }

  const { data: report } = await db
    .from("reports")
    .select("id, description")
    .eq("id", reportId)
    .maybeSingle<ReportContextRow>();
  if (!report) {
    throw new ApiError("not_found", "Laporan tidak ditemukan.");
  }

  const { data: prediction } = await db
    .from("model_predictions")
    .select("severity_probabilities, quality_score")
    .eq("report_id", reportId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ModelPredictionRow>();

  const top = prediction
    ? topSeverityPrediction(prediction.severity_probabilities)
    : { label: "unknown", confidence: 0 };
  const qualityScore = prediction?.quality_score ?? 0;

  let imageBase64: string | null = null;
  let imageMimeType: string | null = null;

  if (input.imageDisclosureLevel !== "none") {
    const { data: evidence } = await db
      .from("report_evidence")
      .select("storage_path, mime_type")
      .eq("report_id", reportId)
      .order("uploaded_at", { ascending: true })
      .limit(1)
      .maybeSingle<EvidenceRow>();

    if (!evidence) {
      throw new ApiError("precondition_failed", "Laporan ini belum memiliki bukti foto untuk dianalisis.");
    }

    const { data: downloaded, error: downloadError } = await db.storage
      .from(env.SUPABASE_REPORTS_BUCKET)
      .download(evidence.storage_path);
    if (downloadError || !downloaded) {
      throw new ApiError("internal_error", "Gagal memuat bukti foto untuk analisis tambahan eksternal.");
    }

    const originalBuffer = Buffer.from(await downloaded.arrayBuffer());

    if (input.imageDisclosureLevel === "redacted_image") {
      const redacted = await redactImage(originalBuffer);
      imageBase64 = redacted.toString("base64");
      imageMimeType = "image/jpeg";
    } else {
      // raw_image — only reachable when the guard above already confirmed
      // consentAccepted + externalDisclosureAccepted are both true.
      imageBase64 = originalBuffer.toString("base64");
      imageMimeType = evidence.mime_type;
    }
  }

  const gemini = {
    apiKey: env.GEMINI_API_KEY,
    model: env.GEMINI_MODEL ?? "gemini-2.0-flash",
    timeoutMs: env.GEMINI_TIMEOUT_MS,
    maxRetries: env.GEMINI_MAX_RETRIES,
    rateLimitPerMinute: env.GEMINI_RATE_LIMIT_REQUESTS_PER_MINUTE,
  };

  try {
    const result = await requestGeminiAdvisory(
      {
        reportDescription: report.description ?? "",
        localModelSummary: {
          prediction: top.label,
          confidence: top.confidence,
          qualityScore,
        },
        imageBase64,
        imageMimeType,
      },
      gemini,
      reportId,
    );

    return recordAdvisoryRequest(db, {
      reportId,
      status: "succeeded",
      imageDisclosureLevel: input.imageDisclosureLevel,
      consentAccepted: input.consentAccepted,
      externalDisclosureAccepted: input.externalDisclosureAccepted,
      structuredOutput: result.structuredOutput,
      errorMessage: null,
      modelName: result.modelName,
      requestId,
      latencyMs: result.latencyMs,
      retryCount: result.retryCount,
    });
  } catch (error) {
    const classified = classifyGeminiError(error);
    return recordAdvisoryRequest(db, {
      reportId,
      status: classified.status,
      imageDisclosureLevel: input.imageDisclosureLevel,
      consentAccepted: input.consentAccepted,
      externalDisclosureAccepted: input.externalDisclosureAccepted,
      structuredOutput: null,
      errorMessage: classified.message,
      modelName: gemini.model,
      requestId,
      latencyMs: classified.latencyMs,
      retryCount: classified.retryCount,
    });
  }
}

function classifyGeminiError(error: unknown): {
  status: "failed" | "timed_out" | "rate_limited";
  message: string;
  latencyMs: number;
  retryCount: number;
} {
  if (error instanceof GeminiTimeoutError) {
    return { status: "timed_out", message: error.message, latencyMs: 0, retryCount: 0 };
  }
  if (error instanceof GeminiRateLimitedError) {
    return { status: "rate_limited", message: error.message, latencyMs: 0, retryCount: 0 };
  }
  if (error instanceof GeminiNotConfiguredError) {
    return { status: "failed", message: error.message, latencyMs: 0, retryCount: 0 };
  }
  if (error instanceof GeminiInvalidResponseError) {
    return { status: "failed", message: error.message, latencyMs: 0, retryCount: 0 };
  }
  const message = error instanceof Error ? error.message : "Gagal memanggil layanan Gemini.";
  return { status: "failed", message, latencyMs: 0, retryCount: 0 };
}

/**
 * Lists every Gemini advisory request made for a report, most recent
 * first — used by the Verifier detail view so a Verifier can see the full
 * history of advisory calls (including failed/rate-limited ones) already
 * made for this report, and by Auditor read access per RBAC_MATRIX.md.
 */
export async function listGeminiAdvisoryRequests(
  db: ReportsDbClient,
  reportId: string,
): Promise<GeminiAdvisoryResponse[]> {
  const { data, error } = await db
    .from("gemini_advisory_requests")
    .select(
      "id, report_id, status, image_disclosure_level, structured_output, error_message, model_name, latency_ms, retry_count, created_at",
    )
    .eq("report_id", reportId)
    .order("created_at", { ascending: false })
    .returns<GeminiAdvisoryRequestRow[]>();

  if (error) {
    throw new ApiError("internal_error", "Gagal memuat riwayat analisis tambahan eksternal.");
  }

  return (data ?? []).map(toGeminiAdvisoryResponse);
}
