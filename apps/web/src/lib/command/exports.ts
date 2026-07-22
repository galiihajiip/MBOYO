import "server-only";
import type { CreateExportJobInput, ExportFormat } from "@mboyo/domain";
import { ApiError } from "../api/errors";
import { getServerEnv } from "../env.server";
import type { CommandDbClient } from "./types";

interface ExportJobRow {
  id: string;
  requested_by_profile_id: string;
  disaster_event_id: string;
  format: ExportFormat;
  filter_criteria: Record<string, unknown>;
  status: "queued" | "processing" | "done" | "failed";
  storage_path: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ExportJobDto {
  id: string;
  disasterEventId: string;
  format: ExportFormat;
  status: "queued" | "processing" | "done" | "failed";
  createdAt: string;
  completedAt: string | null;
  signedUrl: string | null;
}

export async function createExportJob(
  db: CommandDbClient,
  requestedByProfileId: string,
  input: CreateExportJobInput,
): Promise<ExportJobDto> {
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  if (isDemoMode) {
    return {
      id: `demo-export-${Date.now()}`,
      disasterEventId: input.disasterEventId,
      format: input.format,
      status: "done",
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      signedUrl: "https://example.com/demo-export-file.geojson",
    };
  }

  const { data: job, error: insertError } = await db
    .from("export_jobs")
    .insert({
      requested_by_profile_id: requestedByProfileId,
      disaster_event_id: input.disasterEventId,
      format: input.format,
      filter_criteria: input.filterCriteria,
      status: "processing",
    })
    .select("*")
    .single<ExportJobRow>();

  if (insertError || !job) {
    throw new ApiError("internal_error", "Gagal membuat permintaan ekspor.");
  }

  return {
    id: job.id,
    disasterEventId: job.disaster_event_id,
    format: job.format,
    status: job.status,
    createdAt: job.created_at,
    completedAt: job.completed_at,
    signedUrl: null,
  };
}

export async function listExportJobs(db: CommandDbClient): Promise<ExportJobDto[]> {
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  if (isDemoMode) {
    return [
      {
        id: "demo-export-1",
        disasterEventId: "demo-event-1",
        format: "geojson",
        status: "done",
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        signedUrl: "https://example.com/demo-export-1.geojson",
      },
      {
        id: "demo-export-2",
        disasterEventId: "demo-event-1",
        format: "csv",
        status: "done",
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        completedAt: new Date(Date.now() - 3600000).toISOString(),
        signedUrl: "https://example.com/demo-export-2.csv",
      },
    ];
  }

  try {
    const { data, error } = await db
      .from("export_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .returns<ExportJobRow[]>();

    if (!error && data) {
      return data.map((row) => ({
        id: row.id,
        disasterEventId: row.disaster_event_id,
        format: row.format,
        status: row.status,
        createdAt: row.created_at,
        completedAt: row.completed_at,
        signedUrl: null,
      }));
    }
  } catch {}

  throw new ApiError("internal_error", "Gagal memuat riwayat ekspor.");
}
