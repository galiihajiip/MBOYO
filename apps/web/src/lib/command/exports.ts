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
  /** Present only once status is "done" — a fresh short-lived signed URL, never persisted. */
  signedUrl: string | null;
}

/**
 * The full set of fields an export row CAN carry — every one of these is
 * already scoped to command_map_reports (verified-only, no evidence
 * storage_path/private data), so "field redaction" here narrows an
 * already-safe set further per the caller's own choice, it never widens
 * it. This is also the exhaustive list validated against
 * createExportJobSchema's optional `fields` allowlist.
 */
const EXPORTABLE_FIELDS = [
  "reportId",
  "description",
  "status",
  "submittedAt",
  "longitude",
  "latitude",
  "topSeverity",
] as const;
type ExportableField = (typeof EXPORTABLE_FIELDS)[number];

interface ExportSourceRow {
  id: string;
  description: string | null;
  status: string;
  submitted_at: string | null;
  longitude: number | null;
  latitude: number | null;
  top_severity: string | null;
}

const SIGNED_URL_TTL_SECONDS = 300;

function toExportableRecord(row: ExportSourceRow): Record<ExportableField, unknown> {
  return {
    reportId: row.id,
    description: row.description,
    status: row.status,
    submittedAt: row.submitted_at,
    longitude: row.longitude,
    latitude: row.latitude,
    topSeverity: row.top_severity,
  };
}

function applyFieldRedaction(
  record: Record<ExportableField, unknown>,
  fields: string[] | undefined,
): Partial<Record<ExportableField, unknown>> {
  if (!fields || fields.length === 0) return record;
  const allowed = new Set(fields);
  const redacted: Partial<Record<ExportableField, unknown>> = {};
  for (const field of EXPORTABLE_FIELDS) {
    if (allowed.has(field)) redacted[field] = record[field];
  }
  return redacted;
}

function toCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return typeof value === "string" ? value : "";
}

function toCsv(rows: ExportSourceRow[], fields: string[] | undefined): string {
  const activeFields = EXPORTABLE_FIELDS.filter((field) => !fields || fields.length === 0 || fields.includes(field));
  const lines = rows.map((row) => {
    const record = applyFieldRedaction(toExportableRecord(row), fields);
    return activeFields.map((field) => csvEscape(toCsvCell(record[field]))).join(",");
  });
  return [activeFields.join(","), ...lines].join("\n");
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * GeoJSON per RFC 7946: [longitude, latitude] coordinate order (§3.1.1),
 * no `crs` member (§4 — WGS84 is implicit and a crs member SHOULD NOT be
 * present). A row with no location is emitted with `"geometry": null`
 * (explicitly permitted by §3.2 for a Feature whose geometry is
 * unspecified) rather than silently omitted, so an export's feature count
 * always matches its source row count.
 */
function toGeoJson(rows: ExportSourceRow[], fields: string[] | undefined): string {
  const features = rows.map((row) => {
    const record = applyFieldRedaction(toExportableRecord(row), fields);
    // longitude/latitude are structural (geometry), not "properties" a
    // redaction allowlist should hide — they're still included in geometry
    // when present, regardless of the fields list, since a Point Feature
    // with a real location but no coordinates would be self-contradictory.
    return {
      type: "Feature",
      geometry: row.longitude !== null && row.latitude !== null ? { type: "Point", coordinates: [row.longitude, row.latitude] } : null,
      properties: record,
    };
  });
  return JSON.stringify({ type: "FeatureCollection", features }, null, 2);
}

/** Plain JSON array of records — BLOCK 26's third export format, alongside CSV/GeoJSON. */
function toJson(rows: ExportSourceRow[], fields: string[] | undefined): string {
  const records = rows.map((row) => applyFieldRedaction(toExportableRecord(row), fields));
  return JSON.stringify(records, null, 2);
}

/**
 * Creates an export_jobs row and, synchronously within the same request,
 * generates the CSV/GeoJSON file and uploads it to the exports bucket —
 * per this block's user-approved decision to build real file generation
 * (not just a request/status stub), since current data volumes make a
 * background worker unnecessary. Queries public.command_map_reports (the
 * same verified-only, RLS-scoped view Peta Krisis uses) as the export's
 * data source — an export can never include unverified reports or private
 * evidence, matching data-governance's existing disclosure that Coordinator
 * exports carry no raw evidence or unnecessary personal data.
 */
export async function createExportJob(
  db: CommandDbClient,
  requestedByProfileId: string,
  input: CreateExportJobInput,
): Promise<ExportJobDto> {
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

  const { data: sourceRows, error: sourceError } = await db
    .from("command_map_reports")
    .select("id, description, status, submitted_at, longitude, latitude, top_severity")
    .eq("disaster_event_id", input.disasterEventId)
    .returns<ExportSourceRow[]>();

  if (sourceError) {
    await db.from("export_jobs").update({ status: "failed" }).eq("id", job.id);
    throw new ApiError("internal_error", "Gagal memuat data untuk ekspor.");
  }

  const rows = sourceRows ?? [];
  const { fileContent, contentType, extension } = formatExportFile(input.format, rows, input.fields);
  const storagePath = `${input.disasterEventId}/${job.id}.${extension}`;

  // storage_path is written onto the row BEFORE the storage upload, not
  // after — generated_exports_bucket_coordinator_all's RLS policy matches
  // storage.objects rows against export_jobs.storage_path, so the upload's
  // own INSERT into storage.objects would otherwise be checked against a
  // row that doesn't yet reference this path and be denied.
  const { error: pathUpdateError } = await db.from("export_jobs").update({ storage_path: storagePath }).eq("id", job.id);
  if (pathUpdateError) {
    throw new ApiError("internal_error", "Gagal menyiapkan berkas ekspor.");
  }

  const env = getServerEnv();
  const { error: uploadError } = await db.storage
    .from(env.SUPABASE_EXPORTS_BUCKET)
    .upload(storagePath, fileContent, { contentType, upsert: true });

  if (uploadError) {
    await db.from("export_jobs").update({ status: "failed" }).eq("id", job.id);
    throw new ApiError("internal_error", "Gagal menyimpan berkas ekspor.");
  }

  const { data: updatedJob, error: updateError } = await db
    .from("export_jobs")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", job.id)
    .select("*")
    .single<ExportJobRow>();

  if (updateError || !updatedJob) {
    throw new ApiError("internal_error", "Gagal menyelesaikan permintaan ekspor.");
  }

  const { data: signed } = await db.storage.from(env.SUPABASE_EXPORTS_BUCKET).createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  // append_audit_event is granted to `authenticated` directly (no wrapper
  // RPC needed) — every export creation is audited, per this block's
  // "export audit event" requirement, regardless of who requested it
  // (Coordinator's own operational export or an Auditor's compliance
  // export both flow through this same function).
  await db.rpc("append_audit_event", {
    p_entity_type: "export_job",
    p_entity_id: updatedJob.id,
    p_action: "export_job.created",
    p_detail: {
      disasterEventId: updatedJob.disaster_event_id,
      format: updatedJob.format,
      rowCount: rows.length,
      fields: input.fields ?? null,
    },
  });

  return {
    id: updatedJob.id,
    disasterEventId: updatedJob.disaster_event_id,
    format: updatedJob.format,
    status: updatedJob.status,
    createdAt: updatedJob.created_at,
    completedAt: updatedJob.completed_at,
    signedUrl: signed?.signedUrl ?? null,
  };
}

function formatExportFile(
  format: ExportFormat,
  rows: ExportSourceRow[],
  fields: string[] | undefined,
): { fileContent: string; contentType: string; extension: string } {
  switch (format) {
    case "csv":
      return { fileContent: toCsv(rows, fields), contentType: "text/csv", extension: "csv" };
    case "geojson":
      return { fileContent: toGeoJson(rows, fields), contentType: "application/geo+json", extension: "geojson" };
    case "json":
      return { fileContent: toJson(rows, fields), contentType: "application/json", extension: "json" };
  }
}

/** Lists export_jobs the caller may see (RLS-scoped: Coordinator sees own, Auditor sees all). */
export async function listExportJobs(db: CommandDbClient): Promise<ExportJobDto[]> {
  const { data, error } = await db
    .from("export_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<ExportJobRow[]>();

  if (error) {
    throw new ApiError("internal_error", "Gagal memuat riwayat ekspor.");
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    disasterEventId: row.disaster_event_id,
    format: row.format,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    signedUrl: null,
  }));
}
