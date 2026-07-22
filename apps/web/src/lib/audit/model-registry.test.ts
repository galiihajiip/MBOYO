import { describe, expect, it } from "vitest";
import { createFakeDb } from "../reports/service/test-support/fake-db";
import { getGeminiUsageSummary, getModelUsageSummary, listModelEvaluations, listModelRegistryEntries } from "./model-registry";

const ENTRY_ROW = {
  id: "entry-1",
  version: "v1.0.0",
  artifact_path: "models/v1.0.0.onnx",
  trained_at: "2026-07-01T00:00:00.000Z",
  promoted_at: "2026-07-02T00:00:00.000Z",
  is_active: true,
  created_at: "2026-07-01T00:00:00.000Z",
};

const EVALUATION_ROW = {
  id: "eval-1",
  model_registry_entry_id: "entry-1",
  dataset_identity: "holdout-2026-07",
  macro_f1: "0.8500",
  destroyed_recall: "0.9000",
  calibration_error: "0.0500",
  evaluated_at: "2026-07-01T12:00:00.000Z",
  report_path: "ml/reports/eval-v1.md",
};

describe("listModelRegistryEntries", () => {
  it("returns model registry entry DTOs", async () => {
    const fakeDb = createFakeDb({ from: { model_registry_entries: () => ({ data: [ENTRY_ROW], error: null }) } });

    const result = await listModelRegistryEntries(fakeDb as never);
    expect(result).toHaveLength(1);
    expect(result[0]?.version).toBe("v1.0.0");
    expect(result[0]?.isActive).toBe(true);
  });

  it("throws ApiError('internal_error') on a query error", async () => {
    const fakeDb = createFakeDb({
      from: { model_registry_entries: () => ({ data: null, error: { message: "connection reset" } }) },
    });

    await expect(listModelRegistryEntries(fakeDb as never)).rejects.toMatchObject({ code: "internal_error" });
  });
});

describe("listModelEvaluations", () => {
  it("returns model evaluation DTOs with numeric conversions", async () => {
    const fakeDb = createFakeDb({ from: { model_evaluations: () => ({ data: [EVALUATION_ROW], error: null }) } });

    const result = await listModelEvaluations(fakeDb as never);
    expect(result[0]?.macroF1).toBe(0.85);
    expect(result[0]?.destroyedRecall).toBe(0.9);
    expect(result[0]?.calibrationError).toBe(0.05);
  });
});

describe("getModelUsageSummary", () => {
  it("counts analysis_jobs per model_registry_entry_id", async () => {
    const fakeDb = createFakeDb({
      from: {
        model_registry_entries: () => ({ data: [{ id: "entry-1", version: "v1.0.0", is_active: true }], error: null }),
        analysis_jobs: () => ({
          data: [{ model_registry_entry_id: "entry-1" }, { model_registry_entry_id: "entry-1" }, { model_registry_entry_id: null }],
          error: null,
        }),
      },
    });

    const result = await getModelUsageSummary(fakeDb as never);
    expect(result[0]?.predictionCount).toBe(2);
  });
});

describe("getGeminiUsageSummary", () => {
  it("summarizes Gemini advisory request outcomes", async () => {
    const fakeDb = createFakeDb({
      from: {
        gemini_advisory_requests: () => ({
          data: [{ status: "succeeded" }, { status: "failed" }, { status: "timed_out" }, { status: "rate_limited" }],
          error: null,
        }),
      },
    });

    const result = await getGeminiUsageSummary(fakeDb as never);
    expect(result).toEqual({ totalRequests: 4, succeededCount: 1, failedCount: 1, timedOutCount: 1, rateLimitedCount: 1 });
  });

  it("throws ApiError('internal_error') on a query error", async () => {
    const fakeDb = createFakeDb({
      from: { gemini_advisory_requests: () => ({ data: null, error: { message: "connection reset" } }) },
    });

    await expect(getGeminiUsageSummary(fakeDb as never)).rejects.toMatchObject({ code: "internal_error" });
  });
});
