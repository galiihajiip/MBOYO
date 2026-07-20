import "server-only";
import type { VerificationDecision, VerificationRejectReason } from "@mboyo/domain";
import { ApiError } from "../../api/errors";
import type { ReportsDbClient } from "./types";

interface VerificationReviewRow {
  id: string;
  report_id: string;
  verifier_profile_id: string;
  decision: VerificationDecision;
  override_severity: string | null;
  notes: string | null;
  reject_reason_category: VerificationRejectReason | null;
  supersedes_review_id: string | null;
  decided_at: string;
}

export interface VerificationReviewDto {
  id: string;
  verifierProfileId: string;
  decision: VerificationDecision;
  overrideSeverity: string | null;
  notes: string | null;
  rejectReasonCategory: VerificationRejectReason | null;
  supersedesReviewId: string | null;
  decidedAt: string;
}

/**
 * Lists every verification_reviews row for a report, most recent first — the
 * Verifier detail page's review-history Timeline (this block's explicit
 * "immutable review history" requirement: every prior decision remains
 * visible, a later decision is recorded as a NEW row with
 * supersedes_review_id pointing at the one it supersedes, never an
 * UPDATE/DELETE of the earlier row per BLOCK 23's migration design).
 */
export async function listVerificationReviews(
  db: ReportsDbClient,
  reportId: string,
): Promise<VerificationReviewDto[]> {
  const { data, error } = await db
    .from("verification_reviews")
    .select(
      "id, report_id, verifier_profile_id, decision, override_severity, notes, reject_reason_category, supersedes_review_id, decided_at",
    )
    .eq("report_id", reportId)
    .order("decided_at", { ascending: false })
    .returns<VerificationReviewRow[]>();

  if (error) {
    throw new ApiError("internal_error", "Gagal memuat riwayat tinjauan laporan.");
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    verifierProfileId: row.verifier_profile_id,
    decision: row.decision,
    overrideSeverity: row.override_severity,
    notes: row.notes,
    rejectReasonCategory: row.reject_reason_category,
    supersedesReviewId: row.supersedes_review_id,
    decidedAt: row.decided_at,
  }));
}
