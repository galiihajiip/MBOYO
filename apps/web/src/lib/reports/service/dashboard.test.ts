import { describe, expect, it } from "vitest";
import { createFakeDb } from "./test-support/fake-db";
import { getVerifierDashboardMetrics } from "./dashboard";

describe("getVerifierDashboardMetrics", () => {
  it("returns each metric from its corresponding count query, in order", async () => {
    const counts = [5, 2, 3, 1, 4, 7];
    let call = 0;
    const fakeDb = createFakeDb({
      from: {
        verifier_report_queue: () => ({ data: null, error: null, count: counts[call++] }),
        verification_reviews: () => ({ data: null, error: null, count: counts[5] }),
      },
    });

    const result = await getVerifierDashboardMetrics(fakeDb as never);

    expect(result).toEqual({
      waitingCount: 5,
      slaWarningCount: 2,
      lowQualityCount: 3,
      duplicateCount: 1,
      highSeverityCount: 4,
      decisionsToday: 7,
    });
  });

  it("treats a null count as 0 rather than throwing", async () => {
    const fakeDb = createFakeDb({
      from: {
        verifier_report_queue: () => ({ data: null, error: null, count: null }),
        verification_reviews: () => ({ data: null, error: null, count: null }),
      },
    });

    const result = await getVerifierDashboardMetrics(fakeDb as never);
    expect(result.waitingCount).toBe(0);
    expect(result.decisionsToday).toBe(0);
  });

  it("throws ApiError('internal_error') when any one of the six count queries errors", async () => {
    const fakeDb = createFakeDb({
      from: {
        verifier_report_queue: () => ({ data: null, error: { message: "connection reset" }, count: null }),
        verification_reviews: () => ({ data: null, error: null, count: 0 }),
      },
    });

    await expect(getVerifierDashboardMetrics(fakeDb as never)).rejects.toMatchObject({ code: "internal_error" });
  });
});
