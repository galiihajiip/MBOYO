import "server-only";
import { ApiError } from "../../api/errors";
import { toReportSummaryDto, type ReportRow, type ReportsDbClient, type ReportSummaryDto } from "./types";

/**
 * Fetches one report by id — used by both the Reporter's own-detail route
 * and the Verifier's detail route; the only difference between those two
 * callers is which rows RLS lets them see at all (Reporter: own only,
 * Verifier: all), which this function does not need to know about — a row
 * this caller isn't authorized to see simply isn't returned by the SELECT,
 * indistinguishable from a nonexistent id, and both map to the same
 * not_found ApiError. This is the same "RLS is the authorization boundary"
 * pattern BLOCK 15's evidence signed-url route already established.
 */
export async function getReportById(db: ReportsDbClient, reportId: string): Promise<ReportSummaryDto> {
  const { data: report } = await db.from("reports").select("*").eq("id", reportId).maybeSingle<ReportRow>();

  if (!report) {
    throw new ApiError("not_found", "Laporan tidak ditemukan.");
  }

  return toReportSummaryDto(report);
}
