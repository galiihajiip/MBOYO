import { describe, expect, it } from "vitest";
import { createFakeDb } from "./test-support/fake-db";
import { listVerificationReviews } from "./review-history";

const REVIEW_ROW_LATEST = {
  id: "review-2",
  report_id: "report-1",
  verifier_profile_id: "verifier-1",
  decision: "confirm" as const,
  override_severity: null,
  notes: null,
  reject_reason_category: null,
  supersedes_review_id: "review-1",
  decided_at: "2026-07-18T00:00:00.000Z",
};

const REVIEW_ROW_EARLIER = {
  id: "review-1",
  report_id: "report-1",
  verifier_profile_id: "verifier-1",
  decision: "request_info" as const,
  override_severity: null,
  notes: "Perlu foto tambahan.",
  reject_reason_category: null,
  supersedes_review_id: null,
  decided_at: "2026-07-17T00:00:00.000Z",
};

describe("listVerificationReviews", () => {
  it("returns reviews most-recent-first, preserving the supersedes_review_id chain", async () => {
    const fakeDb = createFakeDb({
      from: { verification_reviews: () => ({ data: [REVIEW_ROW_LATEST, REVIEW_ROW_EARLIER], error: null }) },
    });

    const result = await listVerificationReviews(fakeDb as never, "report-1");
    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe("review-2");
    expect(result[0]?.supersedesReviewId).toBe("review-1");
    expect(result[1]?.supersedesReviewId).toBeNull();
  });

  it("returns an empty array when the report has no reviews yet", async () => {
    const fakeDb = createFakeDb({
      from: { verification_reviews: () => ({ data: [], error: null }) },
    });

    const result = await listVerificationReviews(fakeDb as never, "report-1");
    expect(result).toEqual([]);
  });

  it("throws ApiError('internal_error') on a query error", async () => {
    const fakeDb = createFakeDb({
      from: { verification_reviews: () => ({ data: null, error: { message: "connection reset" } }) },
    });

    await expect(listVerificationReviews(fakeDb as never, "report-1")).rejects.toMatchObject({
      code: "internal_error",
    });
  });
});
