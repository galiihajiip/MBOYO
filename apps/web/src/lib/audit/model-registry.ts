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

export async function listModelRegistryEntries(db: CommandDbClient): Promise<ModelRegistryEntryDto[]> {
  try {
    const { data, error } = await db
      .from("model_registry_entries")
      .select("*")
      .order("trained_at", { ascending: false })
      .returns<ModelRegistryEntryRow[]>();

    if (!error && data) {
      return data.map((row) => ({
        id: row.id,
        version: row.version,
        artifactPath: row.artifact_path,
        trainedAt: row.trained_at,
        promotedAt: row.promoted_at,
        isActive: row.is_active,
        createdAt: row.created_at,
      }));
    }
  } catch {}

  throw new ApiError("internal_error", "Gagal memuat riwayat model registry.");
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

export async function listModelEvaluations(db: CommandDbClient): Promise<ModelEvaluationDto[]> {
  try {
    const { data, error } = await db
      .from("model_evaluations")
      .select("*")
      .order("evaluated_at", { ascending: false })
      .returns<ModelEvaluationRow[]>();

    if (!error && data) {
      return data.map((row) => ({
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
  } catch {}

  throw new ApiError("internal_error", "Gagal memuat riwayat evaluasi model.");
}

interface ModelPredictionCountRow {
  model_registry_entry_id: string | null;
}

export async function getModelUsageSummary(db: CommandDbClient): Promise<ModelUsageSummary[]> {
  try {
    const [entriesResult, jobsResult] = await Promise.all([
      db.from("model_registry_entries").select("id, version, is_active").returns<{ id: string; version: string; is_active: boolean }[]>(),
      db.from("analysis_jobs").select("model_registry_entry_id").returns<ModelPredictionCountRow[]>(),
    ]);

    if (!entriesResult.error && !jobsResult.error) {
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
  } catch {}

  throw new ApiError("internal_error", "Gagal memuat ringkasan penggunaan model.");
}

interface GeminiRequestStatusRow {
  status: "succeeded" | "failed" | "timed_out" | "rate_limited";
}

export async function getGeminiUsageSummary(db: CommandDbClient): Promise<GeminiUsageSummary> {
  try {
    const { data, error } = await db.from("gemini_advisory_requests").select("status").returns<GeminiRequestStatusRow[]>();

    if (!error && data) {
      const rows = data;
      return {
        totalRequests: rows.length,
        succeededCount: rows.filter((r) => r.status === "succeeded").length,
        failedCount: rows.filter((r) => r.status === "failed").length,
        timedOutCount: rows.filter((r) => r.status === "timed_out").length,
        rateLimitedCount: rows.filter((r) => r.status === "rate_limited").length,
      };
    }
  } catch {}

  throw new ApiError("internal_error", "Gagal memuat ringkasan penggunaan analisis tambahan eksternal.");
}
