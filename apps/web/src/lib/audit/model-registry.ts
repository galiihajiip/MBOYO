import "server-only";
import type { GeminiUsageSummary, ModelUsageSummary } from "@mboyo/domain";
import { ApiError } from "../api/errors";
import type { CommandDbClient } from "../command/types";

interface ModelRegistryEntryRow {
  id: string;
  version: string;
  artifact_path: string;
  trained_at: string;
  promoted_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ModelRegistryEntryDto {
  id: string;
  version: string;
  artifactPath: string;
  trainedAt: string;
  promotedAt: string | null;
  isActive: boolean;
  createdAt: string;
}

/** Lists every model_registry_entries row, most recently trained first — Auditor's model registry read. */
export async function listModelRegistryEntries(db: CommandDbClient): Promise<ModelRegistryEntryDto[]> {
  const { data, error } = await db
    .from("model_registry_entries")
    .select("*")
    .order("trained_at", { ascending: false })
    .returns<ModelRegistryEntryRow[]>();

  if (error) {
    throw new ApiError("internal_error", "Gagal memuat riwayat model registry.");
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    version: row.version,
    artifactPath: row.artifact_path,
    trainedAt: row.trained_at,
    promotedAt: row.promoted_at,
    isActive: row.is_active,
    createdAt: row.created_at,
  }));
}

interface ModelEvaluationRow {
  id: string;
  model_registry_entry_id: string;
  dataset_identity: string;
  macro_f1: string;
  destroyed_recall: string;
  calibration_error: string;
  evaluated_at: string;
  report_path: string;
}

export interface ModelEvaluationDto {
  id: string;
  modelRegistryEntryId: string;
  datasetIdentity: string;
  macroF1: number;
  destroyedRecall: number;
  calibrationError: number;
  evaluatedAt: string;
  reportPath: string;
}

/** Lists every model_evaluations row — Auditor's "evaluation gates"/model comparison read. */
export async function listModelEvaluations(db: CommandDbClient): Promise<ModelEvaluationDto[]> {
  const { data, error } = await db
    .from("model_evaluations")
    .select("*")
    .order("evaluated_at", { ascending: false })
    .returns<ModelEvaluationRow[]>();

  if (error) {
    throw new ApiError("internal_error", "Gagal memuat riwayat evaluasi model.");
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    modelRegistryEntryId: row.model_registry_entry_id,
    datasetIdentity: row.dataset_identity,
    macroF1: Number(row.macro_f1),
    destroyedRecall: Number(row.destroyed_recall),
    calibrationError: Number(row.calibration_error),
    evaluatedAt: row.evaluated_at,
    reportPath: row.report_path,
  }));
}

interface ModelPredictionCountRow {
  model_registry_entry_id: string | null;
}

/** Model usage — prediction count per registry entry, joining analysis_jobs.model_registry_entry_id (the FK model_predictions itself doesn't carry directly). */
export async function getModelUsageSummary(db: CommandDbClient): Promise<ModelUsageSummary[]> {
  const [entriesResult, jobsResult] = await Promise.all([
    db.from("model_registry_entries").select("id, version, is_active").returns<{ id: string; version: string; is_active: boolean }[]>(),
    db.from("analysis_jobs").select("model_registry_entry_id").returns<ModelPredictionCountRow[]>(),
  ]);

  if (entriesResult.error || jobsResult.error) {
    throw new ApiError("internal_error", "Gagal memuat ringkasan penggunaan model.");
  }

  const countByEntryId = new Map<string, number>();
  for (const job of jobsResult.data ?? []) {
    if (!job.model_registry_entry_id) continue;
    countByEntryId.set(job.model_registry_entry_id, (countByEntryId.get(job.model_registry_entry_id) ?? 0) + 1);
  }

  return (entriesResult.data ?? []).map((entry) => ({
    modelRegistryEntryId: entry.id,
    version: entry.version,
    isActive: entry.is_active,
    predictionCount: countByEntryId.get(entry.id) ?? 0,
  }));
}

interface GeminiRequestStatusRow {
  status: "succeeded" | "failed" | "timed_out" | "rate_limited";
}

/** Gemini usage log summary — org-wide, for Auditor's "external advisory" oversight. */
export async function getGeminiUsageSummary(db: CommandDbClient): Promise<GeminiUsageSummary> {
  const { data, error } = await db.from("gemini_advisory_requests").select("status").returns<GeminiRequestStatusRow[]>();

  if (error) {
    throw new ApiError("internal_error", "Gagal memuat ringkasan penggunaan analisis tambahan eksternal.");
  }

  const rows = data ?? [];
  return {
    totalRequests: rows.length,
    succeededCount: rows.filter((r) => r.status === "succeeded").length,
    failedCount: rows.filter((r) => r.status === "failed").length,
    timedOutCount: rows.filter((r) => r.status === "timed_out").length,
    rateLimitedCount: rows.filter((r) => r.status === "rate_limited").length,
  };
}
