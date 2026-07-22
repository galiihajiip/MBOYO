import "server-only";
import { ApiError } from "../../api/errors";
import { toReportSummaryDto, type ReportRow, type ReportsDbClient, type ReportSummaryDto } from "./types";

export async function getReportById(db: ReportsDbClient, reportId: string): Promise<ReportSummaryDto> {
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  if (isDemoMode) {
    return {
      id: reportId,
      disasterEventId: "demo-event-1",
      clientReportId: `demo-client-${reportId}`,
      title: "Laporan Kerusakan Bangunan Sektor Barat",
      status: "needs_manual_review",
      submittedAt: new Date().toISOString(),
      topSeverity: "destroyed",
      topConfidence: 0.88,
    };
  }

  try {
    const { data: report } = await db.from("reports").select("*").eq("id", reportId).maybeSingle<ReportRow>();
    if (report) {
      return toReportSummaryDto(report);
    }
  } catch {}

  throw new ApiError("not_found", "Laporan tidak ditemukan.");
}
