import "server-only";
import { ApiError } from "../../api/errors";
import { toReportSummaryDto, type ReportRow, type ReportsDbClient, type ReportSummaryDto } from "./types";

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
  try {
    const { data, error } = await db
      .from("verification_reviews")
      .select("report_id, decided_at, notes, reports!inner(*)")
      .eq("decision", "request_info")
      .order("decided_at", { ascending: false })
      .returns<RequestInfoReviewRow[]>();

    if (!error && data) {
      const seenReportIds = new Set<string>();
      const results: InformationRequestReport[] = [];
      for (const row of data) {
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
  } catch {}

  throw new ApiError("internal_error", "Gagal memuat daftar permintaan informasi.");
}
