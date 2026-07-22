import { describe, expect, it } from "vitest";
import { createFakeDb } from "../reports/service/test-support/fake-db";
import { getDecisionLineage } from "./lineage";

const REVIEW_ROW = {
  id: "review-2",
  report_id: "report-1",
  verifier_profile_id: "verifier-1",
  decision: "confirm",
  decided_at: "2026-07-25T00:00:00.000Z",
  supersedes_review_id: "review-1",
};

describe("getDecisionLineage", () => {
  it("returns lineage entries preserving the supersedes_review_id chain", async () => {
    const fakeDb = createFakeDb({ from: { verification_reviews: () => ({ data: [REVIEW_ROW], error: null }) } });

    const result = await getDecisionLineage(fakeDb as never, "report-1");
    expect(result).toHaveLength(1);
    expect(result[0]?.supersedesReviewId).toBe("review-1");
  });

  it("returns an empty array when the report has no reviews yet", async () => {
    const fakeDb = createFakeDb({ from: { verification_reviews: () => ({ data: [], error: null }) } });

    const result = await getDecisionLineage(fakeDb as never, "report-1");
    expect(result).toEqual([]);
  });

  it("throws ApiError('internal_error') on a query error", async () => {
    const fakeDb = createFakeDb({
      from: { verification_reviews: () => ({ data: null, error: { message: "connection reset" } }) },
    });

    await expect(getDecisionLineage(fakeDb as never, "report-1")).rejects.toMatchObject({ code: "internal_error" });
  });
});
