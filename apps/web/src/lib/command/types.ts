import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PriorityLevel, SeverityClass, TaskStatus } from "@mboyo/domain";

/** Same "explicit client argument, directly unit-testable" convention as lib/reports/service/types.ts. */
export type CommandDbClient = SupabaseClient;

// ============================================================================
// incident_cluster
// ============================================================================

export interface IncidentClusterRow {
  id: string;
  disaster_event_id: string;
  label: string;
  priority: PriorityLevel;
  created_by_profile_id: string;
  created_at: string;
}

export interface IncidentClusterDto {
  id: string;
  disasterEventId: string;
  label: string;
  priority: PriorityLevel;
  createdByProfileId: string;
  createdAt: string;
}

export function toIncidentClusterDto(row: IncidentClusterRow): IncidentClusterDto {
  return {
    id: row.id,
    disasterEventId: row.disaster_event_id,
    label: row.label,
    priority: row.priority,
    createdByProfileId: row.created_by_profile_id,
    createdAt: row.created_at,
  };
}

export interface ClusterSummaryRow {
  id: string;
  disaster_event_id: string;
  label: string;
  priority: PriorityLevel;
  created_at: string;
  member_count: number;
  severity_mix: Partial<Record<SeverityClass, number>>;
  evidence_count: number;
  centroid_longitude: number | null;
  centroid_latitude: number | null;
  task_count: number;
}

export interface ClusterSummaryDto {
  id: string;
  disasterEventId: string;
  label: string;
  priority: PriorityLevel;
  createdAt: string;
  memberCount: number;
  severityMix: Partial<Record<SeverityClass, number>>;
  evidenceCount: number;
  centroidLongitude: number | null;
  centroidLatitude: number | null;
  taskCount: number;
}

export function toClusterSummaryDto(row: ClusterSummaryRow): ClusterSummaryDto {
  return {
    id: row.id,
    disasterEventId: row.disaster_event_id,
    label: row.label,
    priority: row.priority,
    createdAt: row.created_at,
    memberCount: row.member_count,
    severityMix: row.severity_mix,
    evidenceCount: row.evidence_count,
    centroidLongitude: row.centroid_longitude,
    centroidLatitude: row.centroid_latitude,
    taskCount: row.task_count,
  };
}

// ============================================================================
// response_task
// ============================================================================

export interface ResponseTaskRow {
  id: string;
  report_id: string | null;
  incident_cluster_id: string | null;
  status: TaskStatus;
  priority: PriorityLevel;
  created_by_profile_id: string;
  category: string | null;
  description: string | null;
  due_at: string | null;
  resources: string | null;
  created_at: string;
  closed_at: string | null;
}

export interface ResponseTaskDto {
  id: string;
  reportId: string | null;
  incidentClusterId: string | null;
  status: TaskStatus;
  priority: PriorityLevel;
  createdByProfileId: string;
  category: string | null;
  description: string | null;
  dueAt: string | null;
  resources: string | null;
  createdAt: string;
  closedAt: string | null;
}

export function toResponseTaskDto(row: ResponseTaskRow): ResponseTaskDto {
  return {
    id: row.id,
    reportId: row.report_id,
    incidentClusterId: row.incident_cluster_id,
    status: row.status,
    priority: row.priority,
    createdByProfileId: row.created_by_profile_id,
    category: row.category,
    description: row.description,
    dueAt: row.due_at,
    resources: row.resources,
    createdAt: row.created_at,
    closedAt: row.closed_at,
  };
}

export interface TaskAssignmentRow {
  id: string;
  response_task_id: string;
  assignee_profile_id: string;
  assigned_by_profile_id: string;
  assigned_at: string;
  unassigned_at: string | null;
}

export interface TaskAssignmentDto {
  id: string;
  responseTaskId: string;
  assigneeProfileId: string;
  assignedByProfileId: string;
  assignedAt: string;
  unassignedAt: string | null;
}

export function toTaskAssignmentDto(row: TaskAssignmentRow): TaskAssignmentDto {
  return {
    id: row.id,
    responseTaskId: row.response_task_id,
    assigneeProfileId: row.assignee_profile_id,
    assignedByProfileId: row.assigned_by_profile_id,
    assignedAt: row.assigned_at,
    unassignedAt: row.unassigned_at,
  };
}

// ============================================================================
// map
// ============================================================================

export interface CommandMapReportRow {
  id: string;
  disaster_event_id: string;
  description: string | null;
  escalated: boolean;
  submitted_at: string | null;
  longitude: number;
  latitude: number;
  top_severity: SeverityClass | null;
  incident_cluster_id: string | null;
}

export interface CommandMapReportDto {
  id: string;
  disasterEventId: string;
  description: string | null;
  escalated: boolean;
  submittedAt: string | null;
  longitude: number;
  latitude: number;
  topSeverity: SeverityClass | null;
  incidentClusterId: string | null;
}

export function toCommandMapReportDto(row: CommandMapReportRow): CommandMapReportDto {
  return {
    id: row.id,
    disasterEventId: row.disaster_event_id,
    description: row.description,
    escalated: row.escalated,
    submittedAt: row.submitted_at,
    longitude: row.longitude,
    latitude: row.latitude,
    topSeverity: row.top_severity,
    incidentClusterId: row.incident_cluster_id,
  };
}

// ============================================================================
// dashboard
// ============================================================================

export interface CommandDashboardMetricsRow {
  verified_incident_count: number;
  critical_cluster_count: number;
  unassigned_priority_count: number;
  active_task_count: number;
  overdue_task_count: number;
  median_response_time_seconds: number | null;
}

export interface CommandDashboardMetrics {
  verifiedIncidentCount: number;
  criticalClusterCount: number;
  unassignedPriorityCount: number;
  activeTaskCount: number;
  overdueTaskCount: number;
  medianResponseTimeSeconds: number | null;
}

export function toCommandDashboardMetrics(row: CommandDashboardMetricsRow): CommandDashboardMetrics {
  return {
    verifiedIncidentCount: row.verified_incident_count,
    criticalClusterCount: row.critical_cluster_count,
    unassignedPriorityCount: row.unassigned_priority_count,
    activeTaskCount: row.active_task_count,
    overdueTaskCount: row.overdue_task_count,
    medianResponseTimeSeconds: row.median_response_time_seconds,
  };
}
