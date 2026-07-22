import "server-only";
import type { AddReportsToClusterInput, CreateIncidentClusterInput, SetPriorityInput } from "@mboyo/domain";
import { ApiError } from "../api/errors";
import {
  toClusterSummaryDto,
  toIncidentClusterDto,
  type ClusterSummaryDto,
  type ClusterSummaryRow,
  type CommandDbClient,
  type IncidentClusterDto,
  type IncidentClusterRow,
} from "./types";

const PRECONDITION_FAILED_SQLSTATE = "P0001";
const NOT_FOUND_SQLSTATE = "P0002";
const INSUFFICIENT_PRIVILEGE_SQLSTATE = "42501";
const VALIDATION_FAILED_SQLSTATE = "22023";

interface PostgrestLikeError {
  code?: string;
  message: string;
}

function translateRpcError(error: PostgrestLikeError, fallbackMessage: string): never {
  if (error.code === INSUFFICIENT_PRIVILEGE_SQLSTATE) {
    throw new ApiError("forbidden", "Anda tidak memiliki izin untuk melakukan tindakan ini.");
  }
  if (error.code === NOT_FOUND_SQLSTATE) {
    throw new ApiError("not_found", "Klaster tidak ditemukan.");
  }
  if (error.code === VALIDATION_FAILED_SQLSTATE) {
    throw new ApiError("validation_failed", error.message);
  }
  if (error.code === PRECONDITION_FAILED_SQLSTATE) {
    throw new ApiError("invalid_transition", error.message);
  }
  throw new ApiError("internal_error", fallbackMessage);
}

/**
 * Creates an incident_cluster from an explicit set of verified reports —
 * always a deliberate Coordinator action naming a human label, never an
 * automatic result of PostGIS proximity grouping (see
 * cluster_destroyed_reports' own "read-only suggestion" comment and this
 * block's user-approved decision). Delegates all validation (verified-only,
 * same disaster_event_id, not-already-clustered) to create_incident_cluster()
 * — this function only translates.
 */
export async function createIncidentCluster(
  db: CommandDbClient,
  input: CreateIncidentClusterInput,
): Promise<IncidentClusterDto> {
  const { data, error } = await db
    .rpc("create_incident_cluster", {
      p_disaster_event_id: input.disasterEventId,
      p_label: input.label,
      p_report_ids: input.reportIds,
    })
    .single<IncidentClusterRow>();

  if (error) {
    translateRpcError(error, "Gagal membuat klaster insiden.");
  }
  if (!data) {
    throw new ApiError("internal_error", "Gagal membuat klaster insiden.");
  }

  return toIncidentClusterDto(data);
}

export async function addReportsToCluster(
  db: CommandDbClient,
  clusterId: string,
  input: AddReportsToClusterInput,
): Promise<IncidentClusterDto> {
  const { data, error } = await db
    .rpc("add_reports_to_cluster", { p_incident_cluster_id: clusterId, p_report_ids: input.reportIds })
    .single<IncidentClusterRow>();

  if (error) {
    translateRpcError(error, "Gagal menambahkan laporan ke klaster.");
  }
  if (!data) {
    throw new ApiError("internal_error", "Gagal menambahkan laporan ke klaster.");
  }

  return toIncidentClusterDto(data);
}

/**
 * Sets (or changes) an incident_cluster's operational priority. Critical
 * priority requires a non-empty reason — enforced by
 * set_incident_cluster_priority() (this block's migration); every change is
 * audited as incident_cluster.priority_changed regardless of the new value.
 */
export async function setIncidentClusterPriority(
  db: CommandDbClient,
  clusterId: string,
  input: SetPriorityInput,
): Promise<IncidentClusterDto> {
  const { data, error } = await db
    .rpc("set_incident_cluster_priority", {
      p_cluster_id: clusterId,
      p_priority: input.priority,
      p_reason: input.reason ?? null,
    })
    .single<IncidentClusterRow>();

  if (error) {
    translateRpcError(error, "Gagal mengubah prioritas klaster.");
  }
  if (!data) {
    throw new ApiError("internal_error", "Gagal mengubah prioritas klaster.");
  }

  return toIncidentClusterDto(data);
}

/**
 * Lists cluster summaries (member count, severity mix, evidence count,
 * task count, centroid) from public.command_cluster_summary (BLOCK 24
 * migration) — used by both Peta Krisis (map markers) and Prioritas (the
 * priority-setting workflow list).
 */
export async function listClusterSummaries(
  db: CommandDbClient,
  disasterEventId?: string,
): Promise<ClusterSummaryDto[]> {
  let query = db.from("command_cluster_summary").select("*");
  if (disasterEventId) {
    query = query.eq("disaster_event_id", disasterEventId);
  }

  const { data, error } = await query.order("created_at", { ascending: false }).returns<ClusterSummaryRow[]>();

  if (error) {
    throw new ApiError("internal_error", "Gagal memuat ringkasan klaster.");
  }

  return (data ?? []).map(toClusterSummaryDto);
}

export async function getClusterSummary(db: CommandDbClient, clusterId: string): Promise<ClusterSummaryDto | null> {
  const { data, error } = await db
    .from("command_cluster_summary")
    .select("*")
    .eq("id", clusterId)
    .maybeSingle<ClusterSummaryRow>();

  if (error) {
    throw new ApiError("internal_error", "Gagal memuat ringkasan klaster.");
  }

  return data ? toClusterSummaryDto(data) : null;
}
