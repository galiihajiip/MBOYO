import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { getServiceRoleClient } from "../../../../lib/supabase/service-role.server";
import { getServerEnv } from "../../../../lib/env.server";
import { authorizeEvidenceUpload } from "../../../../lib/evidence/authorize";
import { validateUploadFilePresence, validateMagicBytes } from "../../../../lib/evidence/validate-upload";
import { processEvidenceImage } from "../../../../lib/evidence/process";
import { computePerceptualHash } from "../../../../lib/evidence/perceptual-hash";
import { checkDuplicateHash } from "../../../../lib/evidence/duplicate-check";
import { EvidenceError, EVIDENCE_ERROR_MESSAGES } from "../../../../lib/evidence/errors";
import type { EvidenceErrorCode } from "@mboyo/domain";

export const dynamic = "force-dynamic";

interface EvidenceSuccessResponse {
  ok: true;
  evidenceId: string;
  sha256Hash: string;
  isDuplicateHash: boolean;
  widthPx: number;
  heightPx: number;
}

interface EvidenceErrorResponse {
  ok: false;
  code: EvidenceErrorCode;
  error: string;
  /**
   * True when a retry with the same input cannot succeed — mirrors the
   * permanent/retryable classification lib/offline/errors.ts already uses
   * client-side, so sync-replay.ts can decide whether to keep retrying.
   */
  permanent: boolean;
}

const PERMANENT_ERROR_CODES: ReadonlySet<EvidenceErrorCode> = new Set([
  "report_not_found",
  "report_not_owned",
  "event_not_found",
  "event_not_active",
  "missing_file",
  "mime_not_allowed",
  "magic_bytes_mismatch",
  "file_too_large",
  "resolution_too_low",
  "decode_failed",
]);

function errorResponse(error: EvidenceError): NextResponse<EvidenceErrorResponse> {
  return NextResponse.json(
    {
      ok: false,
      code: error.code,
      error: error.message,
      permanent: PERMANENT_ERROR_CODES.has(error.code),
    },
    { status: error.httpStatus },
  );
}

/**
 * Protected evidence upload — the full pipeline required by this block:
 * authenticate → validate ownership/event → validate MIME + magic bytes →
 * enforce size/resolution → decode → normalize orientation → strip EXIF →
 * SHA-256 → perceptual hash → thumbnail → store → persist metadata →
 * enqueue analysis job. Supersedes BLOCK 14's intentionally-minimal version
 * (sha256 + raw upload only, no validation pipeline, no perceptual hash, no
 * thumbnail) — this is the real pipeline that version deferred.
 *
 * Called by lib/offline/sync-replay.ts only after the report row itself has
 * synced (see that module) — an orphaned evidence blob referencing a
 * not-yet-existing report is worse than a report temporarily missing its
 * photo, which the Reporter can see and understand from Antrean Offline.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createServerSupabaseClient();

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const reportId = formData?.get("reportId");

  if (typeof reportId !== "string" || !reportId) {
    return errorResponse(new EvidenceError("missing_file", "ID laporan tidak valid.", 400));
  }

  let authorized;
  try {
    authorized = await authorizeEvidenceUpload(supabase, reportId);
  } catch (error) {
    if (error instanceof EvidenceError) return errorResponse(error);
    throw error;
  }

  let mimeType;
  try {
    mimeType = validateUploadFilePresence(file instanceof File ? file : null);
  } catch (error) {
    if (error instanceof EvidenceError) return errorResponse(error);
    throw error;
  }
  const uploadedFile = file as File;

  const arrayBuffer = await uploadedFile.arrayBuffer();
  const inputBuffer = Buffer.from(arrayBuffer);

  try {
    validateMagicBytes(inputBuffer, mimeType);
  } catch (error) {
    if (error instanceof EvidenceError) return errorResponse(error);
    throw error;
  }

  let processed;
  try {
    processed = await processEvidenceImage(inputBuffer);
  } catch (error) {
    if (error instanceof EvidenceError) return errorResponse(error);
    throw error;
  }

  const hashBuffer = await crypto.subtle.digest("SHA-256", new Uint8Array(processed.normalizedBuffer));
  const sha256Hash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const perceptualHash = await computePerceptualHash(processed.normalizedBuffer);

  const env = getServerEnv();
  const storagePath = `${reportId}/${sha256Hash}`;
  const thumbnailPath = `${reportId}/thumb-${sha256Hash}`;

  const { error: uploadError } = await supabase.storage
    .from(env.SUPABASE_REPORTS_BUCKET)
    .upload(storagePath, processed.normalizedBuffer, { contentType: processed.mimeType, upsert: true });
  if (uploadError) {
    return errorResponse(
      new EvidenceError("storage_upload_failed", EVIDENCE_ERROR_MESSAGES.storage_upload_failed, 500),
    );
  }

  const { error: thumbnailUploadError } = await supabase.storage
    .from(env.SUPABASE_REPORTS_BUCKET)
    .upload(thumbnailPath, processed.thumbnailBuffer, { contentType: "image/jpeg", upsert: true });
  if (thumbnailUploadError) {
    return errorResponse(
      new EvidenceError("storage_upload_failed", EVIDENCE_ERROR_MESSAGES.storage_upload_failed, 500),
    );
  }

  // Cross-report duplicate check and the reports/analysis_jobs status
  // transition both need to see beyond this Reporter's own RLS grant (the
  // former reads other reporters' evidence hashes; the latter writes
  // columns reporters have no UPDATE/INSERT policy for at all — see
  // docs/product/WORKING_CONTRACT.md BLOCK 15 entry) — service-role is the
  // documented, narrow exception for this internal orchestration step, not
  // a bypass of the Reporter's own upload authorization (already enforced
  // above via the RLS-scoped client).
  const serviceRoleClient = getServiceRoleClient();

  const isDuplicateHash = await checkDuplicateHash(serviceRoleClient, sha256Hash, reportId);

  const { data: evidenceRow, error: insertError } = await serviceRoleClient
    .from("report_evidence")
    .upsert(
      {
        report_id: reportId,
        storage_path: storagePath,
        thumbnail_path: thumbnailPath,
        mime_type: processed.mimeType,
        size_bytes: processed.normalizedBuffer.byteLength,
        sha256_hash: sha256Hash,
        perceptual_hash: perceptualHash,
        width_px: processed.widthPx,
        height_px: processed.heightPx,
        is_duplicate_hash: isDuplicateHash,
      },
      { onConflict: "report_id,sha256_hash" },
    )
    .select("id")
    .single<{ id: string }>();

  if (insertError || !evidenceRow) {
    return errorResponse(
      new EvidenceError("metadata_persist_failed", EVIDENCE_ERROR_MESSAGES.metadata_persist_failed, 500),
    );
  }

  // Advance the report to evidence_uploaded, then enqueue an analysis job —
  // both idempotent: repeated evidence uploads/replays for the same report
  // only ever move status forward (never regress a report already past this
  // point) and only enqueue a job if the report has none already queued or
  // running, satisfying "repeated offline replay does not duplicate
  // reports" for the analysis pipeline specifically, not just the report
  // row itself (already handled by /api/reports's upsert).
  if (authorized.report.status === "submitted") {
    await serviceRoleClient.from("reports").update({ status: "evidence_uploaded" }).eq("id", reportId);
  }

  const { data: existingJobs } = await serviceRoleClient
    .from("analysis_jobs")
    .select("id")
    .eq("report_id", reportId)
    .in("status", ["queued", "processing"])
    .limit(1);

  if (!existingJobs || existingJobs.length === 0) {
    await serviceRoleClient.from("analysis_jobs").insert({ report_id: reportId, status: "queued" });
    await serviceRoleClient
      .from("reports")
      .update({ status: "analysis_queued" })
      .eq("id", reportId)
      .in("status", ["submitted", "evidence_uploaded"]);
  }

  const response: EvidenceSuccessResponse = {
    ok: true,
    evidenceId: evidenceRow.id,
    sha256Hash,
    isDuplicateHash,
    widthPx: processed.widthPx,
    heightPx: processed.heightPx,
  };
  return NextResponse.json(response, { status: 200 });
}
