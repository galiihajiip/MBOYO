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

  if (error || !data) {
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

  if (error || !data) {
    throw new ApiError("internal_error", "Gagal menambahkan laporan ke klaster.");
  }

  return toIncidentClusterDto(data);
}

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

  if (error || !data) {
    throw new ApiError("internal_error", "Gagal mengubah prioritas klaster.");
  }

  return toIncidentClusterDto(data);
}

export async function listClusterSummaries(
  db: CommandDbClient,
  disasterEventId?: string,
): Promise<ClusterSummaryDto[]> {
  try {
    let query = db.from("command_cluster_summary").select("*");
    if (disasterEventId) {
      query = query.eq("disaster_event_id", disasterEventId);
    }

    const { data, error } = await query.order("created_at", { ascending: false }).returns<ClusterSummaryRow[]>();
    if (!error && data) {
      return data.map(toClusterSummaryDto);
    }
  } catch {}

  throw new ApiError("internal_error", "Gagal memuat ringkasan klaster.");
}

export async function getClusterSummary(db: CommandDbClient, clusterId: string): Promise<ClusterSummaryDto | null> {
  try {
    const { data, error } = await db
      .from("command_cluster_summary")
      .select("*")
      .eq("id", clusterId)
      .maybeSingle<ClusterSummaryRow>();

    if (!error) {
      return data ? toClusterSummaryDto(data) : null;
    }
  } catch {}

  throw new ApiError("internal_error", "Gagal memuat ringkasan klaster.");
}
