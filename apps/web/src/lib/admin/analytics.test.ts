import { describe, expect, it, vi } from "vitest";
import { createFakeDb } from "../reports/service/test-support/fake-db";

vi.mock("../env.server", () => ({
  getServerEnv: () => ({ SUPABASE_REPORTS_BUCKET: "report-evidence", SUPABASE_EXPORTS_BUCKET: "generated-exports" }),
}));

import {
  getIntegrationUsageSummary,
  getServiceHealthSummary,
  getStorageUsageSummaries,
  getUserActivitySummary,
} from "./analytics";

describe("getServiceHealthSummary", () => {
  it("returns queue-depth counts, recent failures, and BLOCK 28 metrics", async () => {
    const fakeDb = createFakeDb({
      from: {
        analysis_jobs: [
          () => ({ data: null, error: null, count: 3 }),
          () => ({ data: null, error: null, count: 1 }),
          () => ({ data: null, error: null, count: 2 }),
          () => ({
            data: [{ report_id: "report-1", error: "decode failed", attempts: 3, created_at: "2026-07-25T00:00:00.000Z" }],
            error: null,
          }),
          () => ({
            data: [
              { created_at: "2026-07-25T00:00:00.000Z", completed_at: "2026-07-25T00:00:10.000Z" },
              { created_at: "2026-07-25T00:00:00.000Z", completed_at: "2026-07-25T00:00:30.000Z" },
            ],
            error: null,
          }),
          () => ({
            data: [
              { report_id: "report-2", error: "Evidence download failed: timeout", attempts: 3, created_at: "2026-07-25T00:00:00.000Z" },
              { report_id: "report-3", error: "decode failed", attempts: 3, created_at: "2026-07-25T00:00:00.000Z" },
            ],
            error: null,
          }),
        ],
        model_predictions: () => ({ data: [{ model_latency_ms: 100 }, { model_latency_ms: 300 }], error: null }),
        audit_events: () => ({ data: null, error: null, count: 4 }),
      },
    });

    const result = await getServiceHealthSummary(fakeDb as never);
    expect(result.analysisJobsQueued).toBe(3);
    expect(result.analysisJobsProcessing).toBe(1);
    expect(result.analysisJobsFailed).toBe(2);
    expect(result.recentFailures).toHaveLength(1);
    expect(result.recentFailures[0]?.reportId).toBe("report-1");
    expect(result.medianJobDurationSeconds).toBe(20);
    expect(result.medianModelLatencyMs).toBe(200);
    expect(result.escalationCount7d).toBe(4);
    expect(result.evidenceDownloadFailureCount7d).toBe(1);
  });

  it("returns null medians when no completed jobs/predictions exist in the window", async () => {
    const fakeDb = createFakeDb({
      from: {
        analysis_jobs: [
          () => ({ data: null, error: null, count: 0 }),
          () => ({ data: null, error: null, count: 0 }),
          () => ({ data: null, error: null, count: 0 }),
          () => ({ data: [], error: null }),
          () => ({ data: [], error: null }),
          () => ({ data: [], error: null }),
        ],
        model_predictions: () => ({ data: [], error: null }),
        audit_events: () => ({ data: null, error: null, count: 0 }),
      },
    });

    const result = await getServiceHealthSummary(fakeDb as never);
    expect(result.medianJobDurationSeconds).toBeNull();
    expect(result.medianModelLatencyMs).toBeNull();
    expect(result.escalationCount7d).toBe(0);
    expect(result.evidenceDownloadFailureCount7d).toBe(0);
  });

  it("throws ApiError('internal_error') when any query errors", async () => {
    const fakeDb = createFakeDb({
      from: {
        analysis_jobs: [
          () => ({ data: null, error: { message: "connection reset" }, count: null }),
          () => ({ data: null, error: null, count: 0 }),
          () => ({ data: null, error: null, count: 0 }),
          () => ({ data: [], error: null }),
          () => ({ data: [], error: null }),
          () => ({ data: [], error: null }),
        ],
        model_predictions: () => ({ data: [], error: null }),
        audit_events: () => ({ data: null, error: null, count: 0 }),
      },
    });

    await expect(getServiceHealthSummary(fakeDb as never)).rejects.toMatchObject({ code: "internal_error" });
  });
});

describe("getStorageUsageSummaries", () => {
  it("sums object sizes per bucket", async () => {
    const fakeDb = createFakeDb({
      storageList: {
        "report-evidence": () => ({
          data: [
            { name: "a.jpg", metadata: { size: 1000 } },
            { name: "b.jpg", metadata: { size: 2000 } },
          ],
          error: null,
        }),
        "generated-exports": () => ({ data: [{ name: "c.csv", metadata: { size: 500 } }], error: null }),
      },
    });

    const result = await getStorageUsageSummaries(fakeDb as never);
    const evidence = result.find((r) => r.bucket === "report-evidence");
    const exports = result.find((r) => r.bucket === "generated-exports");
    expect(evidence?.objectCount).toBe(2);
    expect(evidence?.totalBytes).toBe(3000);
    expect(exports?.objectCount).toBe(1);
    expect(exports?.totalBytes).toBe(500);
  });

  it("handles a bucket with no objects", async () => {
    const fakeDb = createFakeDb({ storageList: {} });

    const result = await getStorageUsageSummaries(fakeDb as never);
    expect(result.every((r) => r.objectCount === 0 && r.totalBytes === 0)).toBe(true);
  });
});

describe("getUserActivitySummary", () => {
  it("counts active role_assignments per role, including zero-count roles", async () => {
    const fakeDb = createFakeDb({
      from: {
        role_assignments: () => ({
          data: [{ role: "verifier" }, { role: "verifier" }, { role: "response_coordinator" }],
          error: null,
        }),
      },
    });

    const result = await getUserActivitySummary(fakeDb as never);
    const verifierCount = result.find((r) => r.role === "verifier")?.activeUserCount;
    const reporterCount = result.find((r) => r.role === "reporter")?.activeUserCount;
    expect(verifierCount).toBe(2);
    expect(reporterCount).toBe(0);
  });

  it("throws ApiError('internal_error') on a query error", async () => {
    const fakeDb = createFakeDb({
      from: { role_assignments: () => ({ data: null, error: { message: "connection reset" } }) },
    });

    await expect(getUserActivitySummary(fakeDb as never)).rejects.toMatchObject({ code: "internal_error" });
  });
});

describe("getIntegrationUsageSummary", () => {
  it("summarizes Gemini and push subscription counts", async () => {
    const fakeDb = createFakeDb({
      from: {
        gemini_advisory_requests: () => ({
          data: [{ status: "succeeded" }, { status: "failed" }, { status: "succeeded" }],
          error: null,
        }),
        push_subscriptions: () => ({ data: null, error: null, count: 5 }),
      },
    });

    const result = await getIntegrationUsageSummary(fakeDb as never);
    expect(result.geminiRequestCount).toBe(3);
    expect(result.geminiSuccessCount).toBe(2);
    expect(result.pushSubscriptionCount).toBe(5);
  });
});
