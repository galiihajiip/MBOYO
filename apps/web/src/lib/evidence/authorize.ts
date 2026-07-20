import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EvidenceError } from "./errors";

interface ReportRow {
  id: string;
  reporter_profile_id: string;
  disaster_event_id: string;
  status: string;
}

export interface AuthorizedUpload {
  profileId: string;
  report: ReportRow;
}

/**
 * Authenticates the caller and validates that the report they're uploading
 * evidence for exists, belongs to them, and references a still-active
 * disaster event — the "authenticate / validate event/ownership" steps of
 * this block's required flow, run before any file bytes are touched so an
 * unauthorized or malformed request is rejected as cheaply as possible.
 *
 * Uses the RLS-scoped client (not service-role) for these reads
 * deliberately: `reports_reporter_select_own` (BLOCK 08 RLS) already
 * enforces ownership at the database layer, so a report belonging to
 * another reporter simply will not be returned — report_not_found and
 * report_not_owned end up meaning almost the same thing here, but are kept
 * as distinct codes since "not found" vs "found but not yours" is a
 * meaningful distinction for API consumers even though RLS collapses them
 * into the same query result today.
 */
export async function authorizeEvidenceUpload(
  supabase: SupabaseClient,
  reportId: string,
): Promise<AuthorizedUpload> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new EvidenceError("unauthenticated", "Sesi tidak valid. Silakan masuk kembali.", 401);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single<{ id: string }>();
  if (!profile) {
    throw new EvidenceError("unauthenticated", "Profil tidak ditemukan.", 401);
  }

  const { data: report } = await supabase
    .from("reports")
    .select("id, reporter_profile_id, disaster_event_id, status")
    .eq("id", reportId)
    .maybeSingle<ReportRow>();

  if (!report) {
    throw new EvidenceError("report_not_found", "Laporan tidak ditemukan.", 404);
  }
  if (report.reporter_profile_id !== profile.id) {
    throw new EvidenceError("report_not_owned", "Laporan ini bukan milik Anda.", 403);
  }

  const { data: event } = await supabase
    .from("disaster_events")
    .select("id, status")
    .eq("id", report.disaster_event_id)
    .maybeSingle<{ id: string; status: string }>();

  if (!event) {
    throw new EvidenceError("event_not_found", "Kejadian bencana terkait tidak ditemukan.", 404);
  }
  if (event.status !== "active") {
    throw new EvidenceError("event_not_active", "Kejadian bencana ini sudah tidak aktif.", 409);
  }

  return { profileId: profile.id, report };
}
