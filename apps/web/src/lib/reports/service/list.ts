import "server-only";
import type { ReportListFilters, PaginationRequest, PaginatedResult } from "@mboyo/domain";
import { buildPaginatedResult } from "@mboyo/domain";
import { ApiError } from "../../api/errors";
import {
  toReportSummaryDto,
  toQueueReportSummaryDto,
  type ReportRow,
  type ReportsDbClient,
  type ReportSummaryDto,
  type QueueReportRow,
  type QueueReportSummaryDto,
} from "./types";

export async function listReports(
  db: ReportsDbClient,
  filters: ReportListFilters,
  pagination: PaginationRequest,
  options: { baseStatuses?: string[] } = {},
): Promise<PaginatedResult<ReportSummaryDto>> {
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  if (isDemoMode) {
    const demoItems = [
      {
        id: "demo-report-1",
        disasterEventId: "demo-event-1",
        clientReportId: "demo-client-1",
        title: "Laporan Kerusakan Bangunan Sektor Barat",
        status: "needs_manual_review" as const,
        submittedAt: new Date().toISOString(),
        topSeverity: "destroyed" as const,
        topConfidence: 0.88,
      },
      {
        id: "demo-report-2",
        disasterEventId: "demo-event-1",
        clientReportId: "demo-client-2",
        title: "Kerusakan Atap Gedung Serbaguna",
        status: "analysis_completed" as const,
        submittedAt: new Date().toISOString(),
        topSeverity: "major_damage" as const,
        topConfidence: 0.75,
      },
    ];
    return buildPaginatedResult(demoItems, demoItems.length, pagination);
  }

  let query = db.from("reports").select("*", { count: "exact" });
  const baseStatuses = options.baseStatuses;
  if (baseStatuses && baseStatuses.length > 0) {
    const effectiveStatuses =
      filters.status && baseStatuses.includes(filters.status) ? [filters.status] : filters.status ? [] : baseStatuses;
    query = query.in("status", effectiveStatuses);
  } else if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.eventId) {
    query = query.eq("disaster_event_id", filters.eventId);
  }
  if (filters.search) {
    query = query.ilike("description", `%${filters.search}%`);
  }

  const from = (pagination.page - 1) * pagination.pageSize;
  const to = from + pagination.pageSize - 1;

  try {
    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to)
      .returns<ReportRow[]>();

    if (!error && data) {
      return buildPaginatedResult(data.map(toReportSummaryDto), count ?? data.length, pagination);
    }
  } catch {}

  throw new ApiError("internal_error", "Gagal memuat daftar laporan.");
}

export async function listQueueReports(
  db: ReportsDbClient,
  filters: ReportListFilters,
  pagination: PaginationRequest,
  options: { baseStatuses?: string[] } = {},
): Promise<PaginatedResult<QueueReportSummaryDto>> {
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  if (isDemoMode) {
    const demoItems = [
      {
        id: "demo-report-1",
        disasterEventId: "demo-event-1",
        clientReportId: "demo-client-1",
        title: "Laporan Rumah Roboh Sektor Barat",
        status: "needs_manual_review" as const,
        submittedAt: new Date().toISOString(),
        topSeverity: "destroyed" as const,
        topConfidence: 0.88,
        qualityScore: 0.92,
        duplicateCandidateReportId: null,
        lastReviewedByVerifierProfileId: null,
      },
      {
        id: "demo-report-2",
        disasterEventId: "demo-event-1",
        clientReportId: "demo-client-2",
        title: "Retakan Dinding Gedung Utama",
        status: "analysis_completed" as const,
        submittedAt: new Date().toISOString(),
        topSeverity: "major_damage" as const,
        topConfidence: 0.75,
        qualityScore: 0.85,
        duplicateCandidateReportId: "demo-report-1",
        lastReviewedByVerifierProfileId: null,
      },
    ];
    return buildPaginatedResult(demoItems, demoItems.length, pagination);
  }

  let query = db.from("verifier_report_queue").select("*", { count: "exact" });
  const baseStatuses = options.baseStatuses;
  if (baseStatuses && baseStatuses.length > 0) {
    const effectiveStatuses =
      filters.status && baseStatuses.includes(filters.status) ? [filters.status] : filters.status ? [] : baseStatuses;
    query = query.in("status", effectiveStatuses);
  } else if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.eventId) {
    query = query.eq("disaster_event_id", filters.eventId);
  }
  if (filters.search) {
    query = query.ilike("description", `%${filters.search}%`);
  }

  const from = (pagination.page - 1) * pagination.pageSize;
  const to = from + pagination.pageSize - 1;

  try {
    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to)
      .returns<QueueReportRow[]>();

    if (!error && data) {
      return buildPaginatedResult(data.map(toQueueReportSummaryDto), count ?? data.length, pagination);
    }
  } catch {}

  throw new ApiError("internal_error", "Gagal memuat antrean verifikasi.");
}
