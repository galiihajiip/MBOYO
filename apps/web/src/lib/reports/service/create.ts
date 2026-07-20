import "server-only";
import type { CreateReportInput } from "@mboyo/domain";
import { ApiError } from "../../api/errors";
import { toReportSummaryDto, type ReportRow, type ReportsDbClient, type ReportSummaryDto } from "./types";

/**
 * Creates (or, on retry, returns) a report — the "create report" domain
 * service. Idempotent on (reporter_profile_id, client_report_id) via
 * upsert, matching the unique index from BLOCK 08's core-schema migration;
 * this is what makes repeated offline sync-replay attempts for the same
 * locally-created report never produce a duplicate row, satisfying this
 * block's "repeated offline replay does not duplicate reports" carry-over
 * from BLOCK 15's evidence work applied to report creation itself.
 *
 * Moved here from apps/web/src/app/api/reports/route.ts (BLOCK 13/14) as
 * part of this block's "typed BFF/domain services" requirement — that
 * route now calls this function instead of inlining the upsert.
 *
 * Appends a `report.created` audit_event (docs/product/STATE_MACHINES.md's
 * `syncing → submitted` transition) — but only on a genuine first insert,
 * never on a retried upsert of an already-existing client_report_id, so a
 * Background Sync replay of the same locally-created report doesn't spam
 * duplicate audit rows for what is, from the audit trail's perspective, one
 * creation event. Checked via an existence lookup before the upsert rather
 * than inferring "was this an insert" from the upsert's own result (Supabase's
 * upsert response doesn't distinguish insert vs. update), which keeps the
 * distinction explicit rather than inferred from timestamp heuristics.
 */
export async function createReport(
  db: ReportsDbClient,
  profileId: string,
  input: CreateReportInput,
): Promise<ReportSummaryDto> {
  const { data: existing } = await db
    .from("reports")
    .select("id")
    .eq("reporter_profile_id", profileId)
    .eq("client_report_id", input.clientReportId)
    .maybeSingle<{ id: string }>();

  const { data: report, error } = await db
    .from("reports")
    .upsert(
      {
        client_report_id: input.clientReportId,
        reporter_profile_id: profileId,
        disaster_event_id: input.eventId,
        description: input.description,
        status: "submitted",
        created_at_client: input.createdAtClient ?? new Date().toISOString(),
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "reporter_profile_id,client_report_id" },
    )
    .select()
    .single<ReportRow>();

  if (error || !report) {
    throw new ApiError("internal_error", "Gagal menyimpan laporan. Silakan coba lagi.");
  }

  if (!existing) {
    await db.rpc("append_audit_event", {
      p_entity_type: "report",
      p_entity_id: report.id,
      p_action: "report.created",
      p_detail: { client_report_id: input.clientReportId, disaster_event_id: input.eventId },
    });
  }

  return toReportSummaryDto(report);
}
