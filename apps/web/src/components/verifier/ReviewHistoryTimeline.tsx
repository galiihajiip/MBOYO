import { Timeline, type TimelineEvent, verificationDecisionStatusLabels, rejectReasonLabels } from "@mboyo/ui";
import type { VerificationReviewDto } from "../../lib/reports/service/review-history";

export interface ReviewHistoryTimelineProps {
  reviews: VerificationReviewDto[];
}

/**
 * Renders the report's full, immutable verification_reviews history — this
 * block's "immutable review history, and a superseding review instead of
 * destructive editing" requirement made visible: every prior decision stays
 * listed (never edited/removed), and a review with supersedes_review_id set
 * is annotated as replacing an earlier one.
 */
export function ReviewHistoryTimeline({ reviews }: ReviewHistoryTimelineProps) {
  if (reviews.length === 0) {
    return <p className="font-sans text-sm text-on-surface-variant">Belum ada riwayat tinjauan untuk laporan ini.</p>;
  }

  const events: TimelineEvent[] = reviews.map((review) => ({
    id: review.id,
    title: verificationDecisionStatusLabels[review.decision],
    timestamp: new Date(review.decidedAt).toLocaleString("id-ID"),
    description: (
      <div className="flex flex-col gap-1">
        {review.rejectReasonCategory ? <p>Kategori: {rejectReasonLabels[review.rejectReasonCategory]}</p> : null}
        {review.notes ? <p>{review.notes}</p> : null}
        {review.supersedesReviewId ? (
          <p className="text-on-surface-variant">Menggantikan keputusan sebelumnya.</p>
        ) : null}
      </div>
    ),
  }));

  return <Timeline events={events} />;
}
