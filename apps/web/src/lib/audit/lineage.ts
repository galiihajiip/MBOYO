import "server-only";
import type { DecisionLineageEntry } from "@mboyo/domain";
import { ApiError } from "../api/errors";
import type { CommandDbClient } from "../command/types";

interface VerificationReviewRow {
  id: string;
  report_id: string;
  verifier_profile_id: string;
  decision: string;
  decided_at: string;
  supersedes_review_id: string | null;
}

/**
 * Decision lineage for one report (BLOCK 26) — the full, immutable
 * verification_reviews history including the supersedes_review_id chain
 * (BLOCK 23), most recent first. This is exactly the "review revisions"
 * mechanism per this block's Auditor requirement: a later review pointing
 * at supersedes_review_id records that it replaces an earlier one, but
 * the earlier row is never edited/deleted — walking this list IS the
 * lineage, no separate reconstruction needed.
 */
export async function getDecisionLineage(db: CommandDbClient, reportId: string): Promise<DecisionLineageEntry[]> {
  const { data, error } = await db
    .from("verification_reviews")
    .select("id, report_id, verifier_profile_id, decision, decided_at, supersedes_review_id")
    .eq("report_id", reportId)
    .order("decided_at", { ascending: false })
    .returns<VerificationReviewRow[]>();

  if (error) {
    throw new ApiError("internal_error", "Gagal memuat riwayat keputusan laporan.");
  }

  return (data ?? []).map((row) => ({
    reviewId: row.id,
    reportId: row.report_id,
    verifierProfileId: row.verifier_profile_id,
    decision: row.decision,
    decidedAt: row.decided_at,
    supersedesReviewId: row.supersedes_review_id,
  }));
}
