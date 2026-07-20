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

/**
 * Shared list-query core for all three "list reports" surfaces this block
 * requires (own list, verifier queue, coordinator operational list) — each
 * differs only in WHICH rows are visible at all (governed entirely by
 * Postgres RLS on the `reports` table: Reporter sees only their own,
 * Verifier sees all, Coordinator sees only `status = 'verified'`, per
 * BLOCK 08's rls_policies migration) and which filters/statuses make sense
 * to expose to that role. This function itself applies NO role logic — it
 * is deliberately dumb, trusting RLS as the single authorization boundary
 * for "which rows," while filters/pagination/sorting are its only concern.
 *
 * Callers pass `baseStatuses` to additionally narrow within their
 * RLS-visible set (e.g. the Verifier queue only wants
 * analysis_completed/needs_manual_review, not every status a Verifier can
 * technically SELECT) — this is a UX narrowing, not a security boundary;
 * the security boundary is RLS, which still applies underneath regardless
 * of what this function requests.
 */
export async function listReports(
  db: ReportsDbClient,
  filters: ReportListFilters,
  pagination: PaginationRequest,
  options: { baseStatuses?: string[] } = {},
): Promise<PaginatedResult<ReportSummaryDto>> {
  let query = db.from("reports").select("*", { count: "exact" });

  const baseStatuses = options.baseStatuses;
  if (baseStatuses && baseStatuses.length > 0) {
    // A caller-requested status filter only applies if it's within this
    // surface's allowed status set — an out-of-scope value narrows to the
    // empty result via an always-false .in([]) rather than being silently
    // ignored (which would leak rows outside the surface's intended scope)
    // or passed through as an invalid enum literal (which Postgres would
    // reject with a type error, not an empty result).
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

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to)
    .returns<ReportRow[]>();

  if (error) {
    throw new ApiError("internal_error", "Gagal memuat daftar laporan.");
  }

  return buildPaginatedResult((data ?? []).map(toReportSummaryDto), count ?? 0, pagination);
}

/**
 * The Antrean Verifikasi queue's list query (BLOCK 23) — queries
 * public.verifier_report_queue (a security_invoker view, see that
 * migration's comment) instead of the raw `reports` table, since every
 * additional filter this screen requires (predicted severity, confidence
 * band, quality ceiling, duplicate-candidate flag, GPS accuracy ceiling,
 * escalation flag, "reviewed by me") depends on a report's LATEST
 * model_predictions/geolocation_observations/verification_reviews row —
 * relationships a plain reports query cannot filter on. RLS underneath the
 * view still governs "which rows" exactly as it does for `listReports`;
 * this function adds filter/sort capability only, no new authorization.
 *
 * `minAgeHours` filters on `submitted_at` (falling back to `created_at`
 * for a report with no submitted_at yet) being older than now - N hours —
 * an SLA/staleness signal, not a hard requirement every report has a
 * submitted_at.
 */
export async function listQueueReports(
  db: ReportsDbClient,
  filters: ReportListFilters,
  pagination: PaginationRequest,
  options: { baseStatuses?: string[] } = {},
): Promise<PaginatedResult<QueueReportSummaryDto>> {
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
  if (filters.predictedSeverity) {
    query = query.eq("top_severity", filters.predictedSeverity);
  }
  if (filters.minConfidence !== undefined) {
    query = query.gte("top_confidence", filters.minConfidence);
  }
  if (filters.maxConfidence !== undefined) {
    query = query.lte("top_confidence", filters.maxConfidence);
  }
  if (filters.maxQualityScore !== undefined) {
    query = query.lte("quality_score", filters.maxQualityScore);
  }
  if (filters.hasDuplicateCandidate) {
    query = query.not("duplicate_candidate_report_id", "is", null);
  }
  if (filters.maxGpsAccuracyMeters !== undefined) {
    query = query.lte("gps_accuracy_meters", filters.maxGpsAccuracyMeters);
  }
  if (filters.minAgeHours !== undefined) {
    const cutoff = new Date(Date.now() - filters.minAgeHours * 60 * 60 * 1000).toISOString();
    query = query.lte("submitted_at", cutoff);
  }
  if (filters.escalatedOnly) {
    query = query.eq("escalated", true);
  }
  if (filters.reviewedByVerifierProfileId) {
    query = query.eq("last_reviewed_by_verifier_profile_id", filters.reviewedByVerifierProfileId);
  }

  const from = (pagination.page - 1) * pagination.pageSize;
  const to = from + pagination.pageSize - 1;

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to)
    .returns<QueueReportRow[]>();

  if (error) {
    throw new ApiError("internal_error", "Gagal memuat antrean verifikasi.");
  }

  return buildPaginatedResult((data ?? []).map(toQueueReportSummaryDto), count ?? 0, pagination);
}
