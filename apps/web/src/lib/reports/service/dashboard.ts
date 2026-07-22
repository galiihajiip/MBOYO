import "server-only";
import { ApiError } from "../../api/errors";
import type { ReportsDbClient } from "./types";

export const SLA_WARNING_HOURS = 24;
const QUEUE_STATUSES = ["analysis_completed", "needs_manual_review"];

export interface VerifierDashboardMetrics {
  waitingCount: number;
  slaWarningCount: number;
  lowQualityCount: number;
  duplicateCount: number;
  highSeverityCount: number;
  decisionsToday: number;
}

export async function getVerifierDashboardMetrics(db: ReportsDbClient): Promise<VerifierDashboardMetrics> {
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  if (isDemoMode) {
    return {
      waitingCount: 18,
      slaWarningCount: 2,
      lowQualityCount: 3,
      duplicateCount: 4,
      highSeverityCount: 7,
      decisionsToday: 15,
    };
  }

  const slaCutoff = new Date(Date.now() - SLA_WARNING_HOURS * 60 * 60 * 1000).toISOString();
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  try {
    const [waiting, slaWarning, lowQuality, duplicate, highSeverity, decisions] = await Promise.all([
      db.from("verifier_report_queue").select("*", { count: "exact", head: true }).in("status", QUEUE_STATUSES),
      db
        .from("verifier_report_queue")
        .select("*", { count: "exact", head: true })
        .in("status", QUEUE_STATUSES)
        .lte("submitted_at", slaCutoff),
      db
        .from("verifier_report_queue")
        .select("*", { count: "exact", head: true })
        .in("status", QUEUE_STATUSES)
        .lte("quality_score", 0.5),
      db
        .from("verifier_report_queue")
        .select("*", { count: "exact", head: true })
        .in("status", QUEUE_STATUSES)
        .not("duplicate_candidate_report_id", "is", null),
      db
        .from("verifier_report_queue")
        .select("*", { count: "exact", head: true })
        .in("status", QUEUE_STATUSES)
        .in("top_severity", ["major_damage", "destroyed"]),
      db
        .from("verification_reviews")
        .select("*", { count: "exact", head: true })
        .gte("decided_at", todayStart.toISOString()),
    ]);

    if (
      !waiting.error &&
      !slaWarning.error &&
      !lowQuality.error &&
      !duplicate.error &&
      !highSeverity.error &&
      !decisions.error
    ) {
      return {
        waitingCount: waiting.count ?? 0,
        slaWarningCount: slaWarning.count ?? 0,
        lowQualityCount: lowQuality.count ?? 0,
        duplicateCount: duplicate.count ?? 0,
        highSeverityCount: highSeverity.count ?? 0,
        decisionsToday: decisions.count ?? 0,
      };
    }
  } catch {}

  throw new ApiError("internal_error", "Gagal memuat metrik dasbor verifikator.");
}
