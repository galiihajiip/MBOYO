import "server-only";
import type { SeverityClass } from "@mboyo/domain";
import { ApiError } from "../../api/errors";
import { toReportSummaryDto, type ReportRow, type ReportsDbClient, type ReportSummaryDto } from "./types";

interface ModelRegistryEntryRow {
  version: string;
  trained_at: string;
  promoted_at: string | null;
}

interface ModelPredictionRow {
  id: string;
  severity_probabilities: Record<SeverityClass, number>;
  quality_score: string;
  duplicate_candidate_report_id: string | null;
  is_advisory_only: boolean;
  created_at: string;
  analysis_jobs: { model_registry_entries: ModelRegistryEntryRow | null } | null;
}

export interface ModelExplanationDto {
  id: string;
  explanationType: string;
  /** Occlusion-sensitivity payload today (see apps/ml-api/app/explain.py) — shape is technique-specific, so left as a loose record rather than a rigid type. */
  payload: Record<string, unknown>;
  createdAt: string;
}

interface ModelExplanationRow {
  id: string;
  explanation_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface ModelMetadataDto {
  version: string;
  trainedAt: string;
  promotedAt: string | null;
}

/**
 * Entropy-based uncertainty over the 5-class severity distribution,
 * normalized to 0..1 (0 = fully certain/one class at probability 1,
 * 1 = maximally uncertain/uniform across all classes). This is NOT a
 * calibration metric (ECE etc., computed offline in ml/'s evaluation
 * pipeline per BLOCK 20 — no per-prediction calibration parameter is
 * persisted anywhere in this schema) — it is a per-prediction spread signal
 * computed client-visibly from the probabilities the Verifier already sees
 * in ProbabilityBars, disclosed as such rather than implying a calibration
 * guarantee that doesn't exist at this granularity.
 */
export function computeUncertainty(probabilities: Record<string, number>): number {
  const values = Object.values(probabilities).filter((p) => p > 0);
  const entropy = -values.reduce((sum, p) => sum + p * Math.log(p), 0);
  const maxEntropy = Math.log(Object.keys(probabilities).length);
  return maxEntropy > 0 ? entropy / maxEntropy : 0;
}

export interface ModelPredictionDto {
  id: string;
  severityProbabilities: Record<SeverityClass, number>;
  qualityScore: number;
  duplicateCandidateReportId: string | null;
  isAdvisoryOnly: boolean;
  uncertainty: number;
  createdAt: string;
  model: ModelMetadataDto | null;
  explanations: ModelExplanationDto[];
}

/**
 * Fetches the latest model_predictions row for a report (joined with its
 * model_registry_entries metadata and every model_explanations row it
 * produced) — the single query backing the Verifier detail page's
 * "probability bars, calibration/uncertainty, Grad-CAM, model metadata"
 * requirements. Returns null when no analysis has completed yet (e.g. a
 * report still in evidence_uploaded/analysis_queued), which the page
 * renders as an explicit "belum ada hasil analisis" state rather than an
 * error.
 *
 * model_predictions has no direct FK to model_registry_entries (it only
 * has analysis_job_id) — the registry link is one hop further, via
 * analysis_jobs.model_registry_entry_id — so the embedded select must
 * traverse analysis_jobs(model_registry_entries(...)); a direct
 * model_registry_entries(...) embed 400s from PostgREST (PGRST200, no FK
 * relationship found).
 */
export async function getLatestModelPrediction(
  db: ReportsDbClient,
  reportId: string,
): Promise<ModelPredictionDto | null> {
  const { data: prediction, error } = await db
    .from("model_predictions")
    .select(
      "id, severity_probabilities, quality_score, duplicate_candidate_report_id, is_advisory_only, created_at, analysis_jobs(model_registry_entries(version, trained_at, promoted_at))",
    )
    .eq("report_id", reportId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ModelPredictionRow>();

  if (error) {
    throw new ApiError("internal_error", "Gagal memuat hasil analisis model.");
  }
  if (!prediction) {
    return null;
  }

  const { data: explanationRows, error: explanationError } = await db
    .from("model_explanations")
    .select("id, explanation_type, payload, created_at")
    .eq("model_prediction_id", prediction.id)
    .order("created_at", { ascending: false })
    .returns<ModelExplanationRow[]>();

  if (explanationError) {
    throw new ApiError("internal_error", "Gagal memuat visualisasi penjelasan model.");
  }

  return {
    id: prediction.id,
    severityProbabilities: prediction.severity_probabilities,
    qualityScore: Number(prediction.quality_score),
    duplicateCandidateReportId: prediction.duplicate_candidate_report_id,
    isAdvisoryOnly: prediction.is_advisory_only,
    uncertainty: computeUncertainty(prediction.severity_probabilities),
    createdAt: prediction.created_at,
    model: prediction.analysis_jobs?.model_registry_entries
      ? {
          version: prediction.analysis_jobs.model_registry_entries.version,
          trainedAt: prediction.analysis_jobs.model_registry_entries.trained_at,
          promotedAt: prediction.analysis_jobs.model_registry_entries.promoted_at,
        }
      : null,
    explanations: (explanationRows ?? []).map((row) => ({
      id: row.id,
      explanationType: row.explanation_type,
      payload: row.payload,
      createdAt: row.created_at,
    })),
  };
}

/**
 * Fetches a minimal summary for a duplicate-candidate report — just enough
 * for the detail page's "duplicate candidate" link/preview
 * (docs/product/SCREEN_INVENTORY.md), not a full report fetch. Returns null
 * if the candidate id is absent or (per RLS) not visible to the caller,
 * matching this codebase's "RLS makes not-found and not-authorized
 * indistinguishable" convention.
 */
export async function getDuplicateCandidateSummary(
  db: ReportsDbClient,
  candidateReportId: string | null,
): Promise<ReportSummaryDto | null> {
  if (!candidateReportId) return null;

  const { data } = await db
    .from("reports")
    .select("*")
    .eq("id", candidateReportId)
    .maybeSingle<ReportRow>();

  return data ? toReportSummaryDto(data) : null;
}
