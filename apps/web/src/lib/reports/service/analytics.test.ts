import { describe, expect, it } from "vitest";
import { createFakeDb } from "./test-support/fake-db";
import { getVerifierAnalytics } from "./analytics";

const REVIEW_ROW_AGREEMENT = {
  review_id: "review-1",
  decision: "confirm",
  review_time_seconds: 3600,
  quality_score: "0.85",
  agreement_classification: "agreement" as const,
};

const REVIEW_ROW_OVERRIDE = {
  review_id: "review-2",
  decision: "override",
  review_time_seconds: 7200,
  quality_score: "0.45",
  agreement_classification: "override" as const,
};

const REVIEW_ROW_OTHER = {
  review_id: "review-3",
  decision: "escalate",
  review_time_seconds: null,
  quality_score: null,
  agreement_classification: "other" as const,
};

const QUEUE_AGE_ROW = { report_id: "report-1", age_seconds: 7200 };

describe("getVerifierAnalytics", () => {
  it("computes review count, agreement/override rate, and medians", async () => {
    const fakeDb = createFakeDb({
      from: {
        verifier_review_analytics: () => ({
          data: [REVIEW_ROW_AGREEMENT, REVIEW_ROW_OVERRIDE, REVIEW_ROW_OTHER],
          error: null,
        }),
        verifier_queue_age: () => ({ data: [QUEUE_AGE_ROW], error: null }),
      },
    });

    const result = await getVerifierAnalytics(fakeDb as never);

    expect(result.reviewCount).toBe(3);
    expect(result.agreementRate).toBe(0.5);
    expect(result.overrideRate).toBe(0.5);
    expect(result.medianReviewTimeSeconds).toBe(5400);
    expect(result.medianQueueAgeSeconds).toBe(7200);
  });

  it("returns 0 rates when there are no classified reviews", async () => {
    const fakeDb = createFakeDb({
      from: {
        verifier_review_analytics: () => ({ data: [REVIEW_ROW_OTHER], error: null }),
        verifier_queue_age: () => ({ data: [], error: null }),
      },
    });

    const result = await getVerifierAnalytics(fakeDb as never);
    expect(result.agreementRate).toBe(0);
    expect(result.overrideRate).toBe(0);
    expect(result.medianQueueAgeSeconds).toBeNull();
  });

  it("buckets queue age into hour-based distribution labels", async () => {
    const fakeDb = createFakeDb({
      from: {
        verifier_review_analytics: () => ({ data: [], error: null }),
        verifier_queue_age: () => ({
          data: [
            { report_id: "r1", age_seconds: 1800 }, // 0.5h -> "< 1 jam"
            { report_id: "r2", age_seconds: 10800 }, // 3h -> "1-6 jam"
          ],
          error: null,
        }),
      },
    });

    const result = await getVerifierAnalytics(fakeDb as never);
    const under1h = result.queueAgeDistribution.find((b) => b.label === "< 1 jam");
    const oneToSixH = result.queueAgeDistribution.find((b) => b.label === "1-6 jam");
    expect(under1h?.count).toBe(1);
    expect(oneToSixH?.count).toBe(1);
  });

  it("throws ApiError('internal_error') when the review analytics query errors", async () => {
    const fakeDb = createFakeDb({
      from: { verifier_review_analytics: () => ({ data: null, error: { message: "connection reset" } }) },
    });

    await expect(getVerifierAnalytics(fakeDb as never)).rejects.toMatchObject({ code: "internal_error" });
  });

  it("throws ApiError('internal_error') when the queue age query errors", async () => {
    const fakeDb = createFakeDb({
      from: {
        verifier_review_analytics: () => ({ data: [], error: null }),
        verifier_queue_age: () => ({ data: null, error: { message: "connection reset" } }),
      },
    });

    await expect(getVerifierAnalytics(fakeDb as never)).rejects.toMatchObject({ code: "internal_error" });
  });
});
