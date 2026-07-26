import "server-only";
import type { DistributionBucket, VerifierAnalytics } from "@mboyo/domain";
import { ApiError } from "../../api/errors";
import type { ReportsDbClient } from "./types";

interface ReviewAnalyticsRow {
  review_id: string;
  decision: string;
  review_time_seconds: number | null;
  quality_score: string | null;
  agreement_classification: "agreement" | "override" | "other";
}

interface QueueAgeRow {
  report_id: string;
  age_seconds: number;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : (sorted[mid] ?? 0);
}

const QUEUE_AGE_BUCKETS: { label: string; maxHours: number }[] = [
  { label: "< 1 jam", maxHours: 1 },
  { label: "1-6 jam", maxHours: 6 },
  { label: "6-24 jam", maxHours: 24 },
  { label: "1-3 hari", maxHours: 72 },
  { label: "> 3 hari", maxHours: Infinity },
];

const QUALITY_BUCKETS: { label: string; max: number }[] = [
  { label: "0.0-0.2", max: 0.2 },
  { label: "0.2-0.4", max: 0.4 },
  { label: "0.4-0.6", max: 0.6 },
  { label: "0.6-0.8", max: 0.8 },
  { label: "0.8-1.0", max: 1.01 },
];

function bucketize(values: number[], buckets: { label: string; max: number }[]): DistributionBucket[] {
  const counts = buckets.map((bucket) => ({ label: bucket.label, count: 0 }));
  for (const value of values) {
    const index = buckets.findIndex((bucket) => value < bucket.max);
    const target = counts[index === -1 ? counts.length - 1 : index];
    if (target) target.count += 1;
  }
  return counts;
}

export async function getVerifierAnalytics(db: ReportsDbClient): Promise<VerifierAnalytics> {
  try {
    const [reviewResult, queueAgeResult] = await Promise.all([
      db.from("verifier_review_analytics").select("*").returns<ReviewAnalyticsRow[]>(),
      db.from("verifier_queue_age").select("*").returns<QueueAgeRow[]>(),
    ]);

    if (!reviewResult.error && !queueAgeResult.error) {
      const reviews = reviewResult.data ?? [];
      const queueAges = queueAgeResult.data ?? [];

      const reviewCount = reviews.length;
      const agreementCount = reviews.filter((r) => r.agreement_classification === "agreement").length;
      const overrideCount = reviews.filter((r) => r.agreement_classification === "override").length;
      const classifiedCount = agreementCount + overrideCount;

      const reviewTimes = reviews
        .map((r) => r.review_time_seconds)
        .filter((value): value is number => value !== null);
      const qualityScores = reviews
        .map((r) => (r.quality_score !== null ? Number(r.quality_score) : null))
        .filter((value): value is number => value !== null);
      const queueAgeSeconds = queueAges.map((row) => row.age_seconds);

      return {
        reviewCount,
        agreementRate: classifiedCount > 0 ? agreementCount / classifiedCount : 0,
        overrideRate: classifiedCount > 0 ? overrideCount / classifiedCount : 0,
        medianReviewTimeSeconds: median(reviewTimes),
        medianQueueAgeSeconds: median(queueAgeSeconds),
        queueAgeDistribution: bucketize(
          queueAgeSeconds.map((seconds) => seconds / 3600),
          QUEUE_AGE_BUCKETS.map((bucket) => ({ label: bucket.label, max: bucket.maxHours })),
        ),
        qualityDistribution: bucketize(qualityScores, QUALITY_BUCKETS),
      };
    }
  } catch {}

  throw new ApiError("internal_error", "Gagal memuat statistik tinjauan verifikator.");
}
