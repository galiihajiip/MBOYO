import "server-only";
import type { ReportStatus, ResponseSlaSummary, SeverityClass, TimelinePoint } from "@mboyo/domain";
import { ApiError } from "../api/errors";
import type { CommandDbClient } from "./types";

interface ReportStatusRow {
  status: ReportStatus;
  disaster_event_id: string;
}

interface DisasterEventRow {
  id: string;
  name: string;
}

export interface AnalyticsBreakdown {
  bySeverity: Partial<Record<SeverityClass, number>>;
  byStatus: Partial<Record<ReportStatus, number>>;
  byRegion: { disasterEventId: string; name: string; count: number }[];
}

/**
 * Analitik's three breakdowns (this block's "jumlah insiden berdasarkan
 * tingkat keparahan, status, dan wilayah" requirement). Severity is
 * computed from command_map_reports (verified reports only, matching every
 * other Coordinator-facing view's scope); status is computed across ALL
 * reports the caller's RLS lets them see (Coordinator: verified only, same
 * scope as everywhere else in this role); "wilayah" (region) has no
 * dedicated column anywhere in this schema — disaster_events.name is used
 * as the closest honest proxy, since each disaster_event already
 * represents one localized incident/region in this domain model. Both
 * aggregations are done in TypeScript over an already-small result set,
 * matching BLOCK 23's "aggregate over a small already-fetched result"
 * precedent (information-requests.ts) rather than adding more database
 * views for a rarely-changing, small-cardinality breakdown.
 */
export async function getIncidentAnalytics(db: CommandDbClient): Promise<AnalyticsBreakdown> {
  const { data: severityRows, error: severityError } = await db
    .from("command_map_reports")
    .select("top_severity")
    .returns<{ top_severity: SeverityClass | null }[]>();

  if (severityError) {
    throw new ApiError("internal_error", "Gagal memuat statistik keparahan.");
  }

  const bySeverity: Partial<Record<SeverityClass, number>> = {};
  for (const row of severityRows ?? []) {
    if (!row.top_severity) continue;
    bySeverity[row.top_severity] = (bySeverity[row.top_severity] ?? 0) + 1;
  }

  const { data: statusRows, error: statusError } = await db
    .from("reports")
    .select("status, disaster_event_id")
    .returns<ReportStatusRow[]>();

  if (statusError) {
    throw new ApiError("internal_error", "Gagal memuat statistik status.");
  }

  const byStatus: Partial<Record<ReportStatus, number>> = {};
  const countByEventId = new Map<string, number>();
  for (const row of statusRows ?? []) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    countByEventId.set(row.disaster_event_id, (countByEventId.get(row.disaster_event_id) ?? 0) + 1);
  }

  const eventIds = Array.from(countByEventId.keys());
  const { data: eventRows, error: eventError } = await db
    .from("disaster_events")
    .select("id, name")
    .in("id", eventIds.length > 0 ? eventIds : ["00000000-0000-0000-0000-000000000000"])
    .returns<DisasterEventRow[]>();

  if (eventError) {
    throw new ApiError("internal_error", "Gagal memuat statistik wilayah.");
  }

  const byRegion = (eventRows ?? [])
    .map((event) => ({ disasterEventId: event.id, name: event.name, count: countByEventId.get(event.id) ?? 0 }))
    .sort((a, b) => b.count - a.count);

  return { bySeverity, byStatus, byRegion };
}

interface ResponseTaskTimingRow {
  status: string;
  due_at: string | null;
  created_at: string;
  closed_at: string | null;
}

/**
 * Response SLA summary (BLOCK 26 addition to Coordinator Analitik) —
 * median completed-task turnaround (created_at -> closed_at, completed
 * only), current overdue count (same due_at < now() and status not in
 * (completed, cancelled) predicate command_dashboard_metrics already
 * established in BLOCK 24, kept consistent here), and how many completed
 * tasks finished before their own due_at ("on time").
 */
export async function getResponseSlaSummary(db: CommandDbClient): Promise<ResponseSlaSummary> {
  const { data, error } = await db
    .from("response_tasks")
    .select("status, due_at, created_at, closed_at")
    .returns<ResponseTaskTimingRow[]>();

  if (error) {
    throw new ApiError("internal_error", "Gagal memuat ringkasan SLA respons.");
  }

  const rows = data ?? [];
  const now = new Date();

  const overdueCount = rows.filter(
    (row) => row.due_at !== null && new Date(row.due_at) < now && row.status !== "completed" && row.status !== "cancelled",
  ).length;

  const completedRows = rows.filter((row) => row.status === "completed" && row.closed_at !== null);
  const durations = completedRows.map(
    (row) => (new Date(row.closed_at!).getTime() - new Date(row.created_at).getTime()) / 1000,
  );
  const onTimeCompletedCount = completedRows.filter(
    (row) => row.due_at === null || new Date(row.closed_at!) <= new Date(row.due_at),
  ).length;

  const sorted = [...durations].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const medianResponseTimeSeconds =
    sorted.length === 0 ? null : sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : (sorted[mid] ?? 0);

  return { medianResponseTimeSeconds, overdueCount, onTimeCompletedCount };
}

interface ReportSubmittedAtRow {
  submitted_at: string | null;
}

/**
 * Daily submission-count timeline for the last `days` days — Coordinator
 * Analitik's "timeline" requirement. Computed in TypeScript over
 * reports.submitted_at (same small-result-set aggregation precedent as
 * every other function in this file) rather than a SQL date_trunc view,
 * since Coordinator's RLS-visible report set (verified only) is already
 * small.
 */
export async function getSubmissionTimeline(db: CommandDbClient, days = 14): Promise<TimelinePoint[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await db
    .from("reports")
    .select("submitted_at")
    .gte("submitted_at", since.toISOString())
    .returns<ReportSubmittedAtRow[]>();

  if (error) {
    throw new ApiError("internal_error", "Gagal memuat garis waktu pengiriman laporan.");
  }

  const countByDate = new Map<string, number>();
  for (const row of data ?? []) {
    if (!row.submitted_at) continue;
    const date = row.submitted_at.slice(0, 10);
    countByDate.set(date, (countByDate.get(date) ?? 0) + 1);
  }

  const points: TimelinePoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    points.push({ date: key, count: countByDate.get(key) ?? 0 });
  }

  return points;
}
