import "server-only";
import { ApiError } from "../../api/errors";
import { toReportSummaryDto, type ReportRow, type ReportsDbClient, type ReportSummaryDto } from "./types";

export async function getReportById(db: ReportsDbClient, reportId: string): Promise<ReportSummaryDto> {
  try {
    const { data: report } = await db.from("reports").select("*").eq("id", reportId).maybeSingle<ReportRow>();
    if (report) {
      return toReportSummaryDto(report);
    }
  } catch {}

  throw new ApiError("not_found", "Laporan tidak ditemukan.");
}
