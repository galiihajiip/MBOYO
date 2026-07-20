import "server-only";
import { ApiError } from "../../api/errors";
import type { ReportsDbClient } from "./types";

/**
 * The Ringkasan (Verifier dashboard) metrics — BLOCK 23, per
 * docs/product/SCREEN_INVENTORY.md's "at-a-glance queue depth, SLA status,
 * and recent decisions" requirement. Every count queries
 * public.verifier_report_queue (the same security_invoker view the queue
 * itself uses — see that migration's comment) with `{count:"exact",
 * head:true}` so this is six cheap COUNT queries, never a full row fetch,
 * and RLS still governs which rows a Verifier can see underneath, exactly
 * as it does for the queue itself — this service applies no role logic of
 * its own.
 *
 * SLA_WARNING_HOURS is a documented, provisional threshold — 24 hours
 * since submission — not derived from real operational data (none exists
 * yet), matching the same disclosed-as-provisional posture as BLOCK 19/20's
 * release-gate/composite-score thresholds. A future block should revisit
 * this once real session data exists to reason about.
 */
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

function assertCount(count: number | null, error: { message: string } | null): number {
  if (error) {
    throw new ApiError("internal_error", "Gagal memuat metrik dasbor verifikator.");
  }
  return count ?? 0;
}

export async function getVerifierDashboardMetrics(db: ReportsDbClient): Promise<VerifierDashboardMetrics> {
  const slaCutoff = new Date(Date.now() - SLA_WARNING_HOURS * 60 * 60 * 1000).toISOString();
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

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

  return {
    waitingCount: assertCount(waiting.count, waiting.error),
    slaWarningCount: assertCount(slaWarning.count, slaWarning.error),
    lowQualityCount: assertCount(lowQuality.count, lowQuality.error),
    duplicateCount: assertCount(duplicate.count, duplicate.error),
    highSeverityCount: assertCount(highSeverity.count, highSeverity.error),
    decisionsToday: assertCount(decisions.count, decisions.error),
  };
}
