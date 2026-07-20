import { describe, expect, it } from "vitest";
import { createFakeDb } from "./test-support/fake-db";
import { listReports, listQueueReports } from "./list";
import { ApiError } from "../../api/errors";

const QUEUE_ROW = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "report-1",
  client_report_id: "client-1",
  reporter_profile_id: "profile-1",
  disaster_event_id: "event-1",
  status: "needs_manual_review",
  description: "Rumah roboh sebagian",
  escalated: false,
  submitted_at: "2026-07-17T00:00:00.000Z",
  created_at: "2026-07-17T00:00:00.000Z",
  updated_at: "2026-07-17T00:00:00.000Z",
  top_severity: "minor_damage",
  top_confidence: "0.850",
  quality_score: "0.900",
  duplicate_candidate_report_id: null,
  is_advisory_only: false,
  gps_accuracy_meters: "12.50",
  gps_confidence_signal: "0.900",
  gps_longitude: 106.827,
  gps_latitude: -6.175,
  last_reviewed_by_verifier_profile_id: null,
  ...overrides,
});

const ROW = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "report-1",
  client_report_id: "client-1",
  reporter_profile_id: "profile-1",
  disaster_event_id: "event-1",
  status: "verified",
  description: "Rumah roboh sebagian",
  created_at_client: null,
  submitted_at: "2026-07-17T00:00:00.000Z",
  archived_at: null,
  created_at: "2026-07-17T00:00:00.000Z",
  updated_at: "2026-07-17T00:00:00.000Z",
  ...overrides,
});

describe("listReports", () => {
  it("returns a paginated result built from the query's rows and count", async () => {
    const fakeDb = createFakeDb({
      from: { reports: () => ({ data: [ROW(), ROW({ id: "report-2" })], error: null, count: 2 }) },
    });

    const result = await listReports(fakeDb as never, {}, { page: 1, pageSize: 20 });
    expect(result.items).toHaveLength(2);
    expect(result.totalCount).toBe(2);
    expect(result.totalPages).toBe(1);
  });

  it("throws ApiError('internal_error') on a query error", async () => {
    const fakeDb = createFakeDb({
      from: { reports: () => ({ data: null, error: { message: "connection reset" } }) },
    });

    await expect(listReports(fakeDb as never, {}, { page: 1, pageSize: 20 })).rejects.toMatchObject({
      code: "internal_error",
    });
    await expect(listReports(fakeDb as never, {}, { page: 1, pageSize: 20 })).rejects.toBeInstanceOf(ApiError);
  });

  it("applies baseStatuses as an .in() filter when no explicit status filter is given (verifier queue shape)", async () => {
    let capturedBuilder: { calls: Array<{ method: string; args: unknown[] }> } | undefined;
    const fakeDb = createFakeDb({
      from: {
        reports: () => ({ data: [], error: null, count: 0 }),
      },
    });

    const originalFrom = fakeDb.from.bind(fakeDb);
    fakeDb.from = (table: string) => {
      const builder = originalFrom(table);
      capturedBuilder = builder;
      return builder;
    };

    await listReports(
      fakeDb as never,
      {},
      { page: 1, pageSize: 20 },
      { baseStatuses: ["analysis_completed", "needs_manual_review"] },
    );

    const inCall = capturedBuilder?.calls.find((c) => c.method === "in");
    expect(inCall?.args).toEqual(["status", ["analysis_completed", "needs_manual_review"]]);
  });

  it("narrows to the single requested status when it's within baseStatuses", async () => {
    let capturedBuilder: { calls: Array<{ method: string; args: unknown[] }> } | undefined;
    const fakeDb = createFakeDb({ from: { reports: () => ({ data: [], error: null, count: 0 }) } });
    const originalFrom = fakeDb.from.bind(fakeDb);
    fakeDb.from = (table: string) => {
      const builder = originalFrom(table);
      capturedBuilder = builder;
      return builder;
    };

    await listReports(
      fakeDb as never,
      { status: "needs_manual_review" },
      { page: 1, pageSize: 20 },
      { baseStatuses: ["analysis_completed", "needs_manual_review"] },
    );

    const inCall = capturedBuilder?.calls.find((c) => c.method === "in");
    expect(inCall?.args).toEqual(["status", ["needs_manual_review"]]);
  });

  it("narrows to an impossible (empty) filter when the requested status is outside baseStatuses — never leaks out-of-scope rows", async () => {
    let capturedBuilder: { calls: Array<{ method: string; args: unknown[] }> } | undefined;
    const fakeDb = createFakeDb({ from: { reports: () => ({ data: [], error: null, count: 0 }) } });
    const originalFrom = fakeDb.from.bind(fakeDb);
    fakeDb.from = (table: string) => {
      const builder = originalFrom(table);
      capturedBuilder = builder;
      return builder;
    };

    await listReports(
      fakeDb as never,
      { status: "draft_local" },
      { page: 1, pageSize: 20 },
      { baseStatuses: ["verified"] },
    );

    const inCall = capturedBuilder?.calls.find((c) => c.method === "in");
    expect(inCall?.args).toEqual(["status", []]);
  });
});

describe("listQueueReports", () => {
  it("returns a paginated result of QueueReportSummaryDto, converting numeric-string columns", async () => {
    const fakeDb = createFakeDb({
      from: { verifier_report_queue: () => ({ data: [QUEUE_ROW()], error: null, count: 1 }) },
    });

    const result = await listQueueReports(fakeDb as never, {}, { page: 1, pageSize: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.topConfidence).toBe(0.85);
    expect(result.items[0]?.qualityScore).toBe(0.9);
    expect(result.items[0]?.gpsAccuracyMeters).toBe(12.5);
  });

  it("applies predictedSeverity, confidence band, and quality ceiling as query filters", async () => {
    let capturedBuilder: { calls: Array<{ method: string; args: unknown[] }> } | undefined;
    const fakeDb = createFakeDb({
      from: { verifier_report_queue: () => ({ data: [], error: null, count: 0 }) },
    });
    const originalFrom = fakeDb.from.bind(fakeDb);
    fakeDb.from = (table: string) => {
      const builder = originalFrom(table);
      capturedBuilder = builder;
      return builder;
    };

    await listQueueReports(
      fakeDb as never,
      { predictedSeverity: "major_damage", minConfidence: 0.3, maxConfidence: 0.6, maxQualityScore: 0.5 },
      { page: 1, pageSize: 20 },
    );

    expect(capturedBuilder?.calls.find((c) => c.method === "eq" && c.args[0] === "top_severity")?.args).toEqual([
      "top_severity",
      "major_damage",
    ]);
    expect(capturedBuilder?.calls.find((c) => c.method === "gte")?.args).toEqual(["top_confidence", 0.3]);
    expect(capturedBuilder?.calls.find((c) => c.method === "lte" && c.args[0] === "top_confidence")?.args).toEqual([
      "top_confidence",
      0.6,
    ]);
    expect(capturedBuilder?.calls.find((c) => c.method === "lte" && c.args[0] === "quality_score")?.args).toEqual([
      "quality_score",
      0.5,
    ]);
  });

  it("applies hasDuplicateCandidate as a not-null filter and escalatedOnly as an eq(true) filter", async () => {
    let capturedBuilder: { calls: Array<{ method: string; args: unknown[] }> } | undefined;
    const fakeDb = createFakeDb({
      from: { verifier_report_queue: () => ({ data: [], error: null, count: 0 }) },
    });
    const originalFrom = fakeDb.from.bind(fakeDb);
    fakeDb.from = (table: string) => {
      const builder = originalFrom(table);
      capturedBuilder = builder;
      return builder;
    };

    await listQueueReports(
      fakeDb as never,
      { hasDuplicateCandidate: true, escalatedOnly: true },
      { page: 1, pageSize: 20 },
    );

    expect(capturedBuilder?.calls.find((c) => c.method === "not")?.args).toEqual([
      "duplicate_candidate_report_id",
      "is",
      null,
    ]);
    expect(capturedBuilder?.calls.find((c) => c.method === "eq" && c.args[0] === "escalated")?.args).toEqual([
      "escalated",
      true,
    ]);
  });

  it("throws ApiError('internal_error') on a query error", async () => {
    const fakeDb = createFakeDb({
      from: { verifier_report_queue: () => ({ data: null, error: { message: "connection reset" } }) },
    });

    await expect(listQueueReports(fakeDb as never, {}, { page: 1, pageSize: 20 })).rejects.toMatchObject({
      code: "internal_error",
    });
    await expect(listQueueReports(fakeDb as never, {}, { page: 1, pageSize: 20 })).rejects.toBeInstanceOf(ApiError);
  });
});
