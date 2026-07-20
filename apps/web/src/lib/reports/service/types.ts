import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReportStatus, SeverityClass } from "@mboyo/domain";

/**
 * Every domain-service function in this directory takes an explicit
 * SupabaseClient (not a global/module-cached one) as its first argument —
 * this is what makes them directly unit-testable (a test passes a fake
 * client implementing just the query-builder surface a given function
 * calls) without needing a live Supabase instance or mocking next/server.
 * Route handlers pass the request-scoped RLS-bound client from
 * lib/supabase/server.ts.
 */
export type ReportsDbClient = SupabaseClient;

export interface ReportRow {
  id: string;
  client_report_id: string;
  reporter_profile_id: string;
  disaster_event_id: string;
  status: ReportStatus;
  description: string | null;
  created_at_client: string | null;
  submitted_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportSummaryDto {
  id: string;
  clientReportId: string;
  disasterEventId: string;
  status: ReportStatus;
  description: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toReportSummaryDto(row: ReportRow): ReportSummaryDto {
  return {
    id: row.id,
    clientReportId: row.client_report_id,
    disasterEventId: row.disaster_event_id,
    status: row.status,
    description: row.description,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Row shape of public.verifier_report_queue (BLOCK 23 migration) — a
 * security_invoker view pre-joining each report's latest
 * model_predictions/geolocation_observations/verification_reviews signal
 * so the Antrean Verifikasi queue can filter/sort on them directly. See
 * that migration's own comment for why a view was needed at all (a plain
 * .from("reports") query has no way to express "latest row from a
 * one-to-many child table" as a column filter).
 */
export interface QueueReportRow {
  id: string;
  client_report_id: string;
  reporter_profile_id: string;
  disaster_event_id: string;
  status: ReportStatus;
  description: string | null;
  escalated: boolean;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  top_severity: SeverityClass | null;
  top_confidence: string | null;
  quality_score: string | null;
  duplicate_candidate_report_id: string | null;
  is_advisory_only: boolean | null;
  gps_accuracy_meters: string | null;
  gps_confidence_signal: string | null;
  gps_longitude: number | null;
  gps_latitude: number | null;
  last_reviewed_by_verifier_profile_id: string | null;
}

export interface QueueReportSummaryDto extends ReportSummaryDto {
  escalated: boolean;
  topSeverity: SeverityClass | null;
  topConfidence: number | null;
  qualityScore: number | null;
  duplicateCandidateReportId: string | null;
  isAdvisoryOnly: boolean | null;
  gpsAccuracyMeters: number | null;
  gpsConfidenceSignal: number | null;
  gpsLongitude: number | null;
  gpsLatitude: number | null;
}

export function toQueueReportSummaryDto(row: QueueReportRow): QueueReportSummaryDto {
  return {
    id: row.id,
    clientReportId: row.client_report_id,
    disasterEventId: row.disaster_event_id,
    status: row.status,
    description: row.description,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    escalated: row.escalated,
    topSeverity: row.top_severity,
    topConfidence: row.top_confidence === null ? null : Number(row.top_confidence),
    qualityScore: row.quality_score === null ? null : Number(row.quality_score),
    duplicateCandidateReportId: row.duplicate_candidate_report_id,
    isAdvisoryOnly: row.is_advisory_only,
    gpsAccuracyMeters: row.gps_accuracy_meters === null ? null : Number(row.gps_accuracy_meters),
    gpsConfidenceSignal: row.gps_confidence_signal === null ? null : Number(row.gps_confidence_signal),
    gpsLongitude: row.gps_longitude,
    gpsLatitude: row.gps_latitude,
  };
}
