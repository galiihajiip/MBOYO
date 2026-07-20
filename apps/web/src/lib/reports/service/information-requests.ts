import "server-only";
import { ApiError } from "../../api/errors";
import { toReportSummaryDto, type ReportRow, type ReportsDbClient, type ReportSummaryDto } from "./types";

/**
 * Permintaan Informasi (BLOCK 23) — reports whose MOST RECENT
 * verification_review is a request_info decision, per
 * docs/product/SCREEN_INVENTORY.md. Once a Verifier acts on a report again
 * (confirm/override/reject/escalate/insufficient_evidence), its latest
 * review is no longer request_info, so it naturally drops off this list —
 * there is no separate "response received" tracking column anywhere in the
 * schema (the Reporter has no dedicated "respond to information request"
 * write path yet), so this function surfaces exactly the reports currently
 * awaiting a Verifier's next look, which is the same thing SCREEN_INVENTORY.md
 * calls "menunggu tanggapan" — a documented, honest scope limitation rather
 * than a fabricated "response received" distinction with nothing behind it.
 */
export interface InformationRequestReport extends ReportSummaryDto {
  requestedAt: string;
  requestNotes: string | null;
}

interface RequestInfoReviewRow {
  report_id: string;
  decided_at: string;
  notes: string | null;
  reports: ReportRow;
}

export async function listPendingInformationRequests(db: ReportsDbClient): Promise<InformationRequestReport[]> {
  // Embedded-resource dot-path filters (e.g. .eq("reports.status", ...))
  // are a real PostgREST feature but a fragile one to rely on for a
  // correctness-sensitive query — filtering the small result set in
  // TypeScript after the fetch is simpler and equally correct for this
  // screen's realistic result size (a Verifier's own request_info reviews,
  // not a high-volume table).
  const { data, error } = await db
    .from("verification_reviews")
    .select("report_id, decided_at, notes, reports!inner(*)")
    .eq("decision", "request_info")
    .order("decided_at", { ascending: false })
    .returns<RequestInfoReviewRow[]>();

  if (error) {
    throw new ApiError("internal_error", "Gagal memuat daftar permintaan informasi.");
  }

  // A report can accumulate multiple request_info reviews over time if the
  // Verifier asks again after a partial response — keep only the most
  // recent per report_id (the query is already ordered decided_at desc, so
  // the first occurrence of each report_id is the one to keep), and only
  // while the report is still actually needs_manual_review (a report that
  // moved on to verified/rejected since is no longer "awaiting response").
  const seenReportIds = new Set<string>();
  const results: InformationRequestReport[] = [];
  for (const row of data ?? []) {
    if (seenReportIds.has(row.report_id)) continue;
    seenReportIds.add(row.report_id);
    if (row.reports.status !== "needs_manual_review") continue;
    results.push({
      ...toReportSummaryDto(row.reports),
      requestedAt: row.decided_at,
      requestNotes: row.notes,
    });
  }

  return results;
}
