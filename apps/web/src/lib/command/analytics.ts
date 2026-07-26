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

export async function getIncidentAnalytics(db: CommandDbClient): Promise<AnalyticsBreakdown> {
  try {
    const { data: severityRows, error: severityError } = await db
      .from("command_map_reports")
      .select("top_severity")
      .returns<{ top_severity: SeverityClass | null }[]>();

    const { data: statusRows, error: statusError } = await db
      .from("reports")
      .select("status, disaster_event_id")
      .returns<ReportStatusRow[]>();

    if (!severityError && !statusError && severityRows && statusRows) {
      const bySeverity: Partial<Record<SeverityClass, number>> = {};
      for (const row of severityRows) {
        if (!row.top_severity) continue;
        bySeverity[row.top_severity] = (bySeverity[row.top_severity] ?? 0) + 1;
      }

      const byStatus: Partial<Record<ReportStatus, number>> = {};
      const countByEventId = new Map<string, number>();
      for (const row of statusRows) {
        byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
        countByEventId.set(row.disaster_event_id, (countByEventId.get(row.disaster_event_id) ?? 0) + 1);
      }

      const eventIds = Array.from(countByEventId.keys());
      const { data: eventRows } = await db
        .from("disaster_events")
        .select("id, name")
        .in("id", eventIds.length > 0 ? eventIds : ["00000000-0000-0000-0000-000000000000"])
        .returns<DisasterEventRow[]>();

      const byRegion = (eventRows ?? [])
        .map((event) => ({ disasterEventId: event.id, name: event.name, count: countByEventId.get(event.id) ?? 0 }))
        .sort((a, b) => b.count - a.count);

      return { bySeverity, byStatus, byRegion };
    }
  } catch {}

  throw new ApiError("internal_error", "Gagal memuat statistik analitik.");
}

interface ResponseTaskTimingRow {
  status: string;
  due_at: string | null;
  created_at: string;
  closed_at: string | null;
}

export async function getResponseSlaSummary(db: CommandDbClient): Promise<ResponseSlaSummary> {
  try {
    const { data, error } = await db
      .from("response_tasks")
      .select("status, due_at, created_at, closed_at")
      .returns<ResponseTaskTimingRow[]>();

    if (!error && data) {
      const rows = data;
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
  } catch {}

  throw new ApiError("internal_error", "Gagal memuat ringkasan SLA respons.");
}

interface ReportSubmittedAtRow {
  submitted_at: string | null;
}

export async function getSubmissionTimeline(db: CommandDbClient, days = 14): Promise<TimelinePoint[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  try {
    const { data, error } = await db
      .from("reports")
      .select("submitted_at")
      .gte("submitted_at", since.toISOString())
      .returns<ReportSubmittedAtRow[]>();

    if (!error && data) {
      const countByDate = new Map<string, number>();
      for (const row of data) {
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
  } catch {}

  throw new ApiError("internal_error", "Gagal memuat garis waktu pengiriman laporan.");
}
