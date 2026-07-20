import { describe, expect, it } from "vitest";
import { createFakeDb } from "./test-support/fake-db";
import { ApiError } from "../../api/errors";
import { computeUncertainty, getDuplicateCandidateSummary, getLatestModelPrediction } from "./analysis";

const PREDICTION_ROW = {
  id: "prediction-1",
  severity_probabilities: { unknown: 0.02, no_damage: 0.03, minor_damage: 0.85, major_damage: 0.08, destroyed: 0.02 },
  quality_score: "0.900",
  duplicate_candidate_report_id: null,
  is_advisory_only: false,
  created_at: "2026-07-17T00:00:00.000Z",
  model_registry_entries: { version: "v1.2.0", trained_at: "2026-06-01T00:00:00.000Z", promoted_at: "2026-06-05T00:00:00.000Z" },
};

const EXPLANATION_ROW = {
  id: "explanation-1",
  explanation_type: "occlusion_sensitivity",
  payload: { heatmapPngBase64: "abc123", targetClass: "minor_damage", disclaimer: "not causal" },
  created_at: "2026-07-17T00:00:00.000Z",
};

const REPORT_ROW = {
  id: "report-2",
  client_report_id: "client-2",
  reporter_profile_id: "profile-1",
  disaster_event_id: "event-1",
  status: "verified",
  description: "Kandidat duplikat",
  created_at_client: null,
  submitted_at: "2026-07-17T00:00:00.000Z",
  archived_at: null,
  created_at: "2026-07-17T00:00:00.000Z",
  updated_at: "2026-07-17T00:00:00.000Z",
};

describe("computeUncertainty", () => {
  it("returns near 0 for a confident, near-one-hot distribution", () => {
    const uncertainty = computeUncertainty({ a: 0.98, b: 0.02 });
    expect(uncertainty).toBeLessThan(0.2);
  });

  it("returns 1 for a uniform distribution across all classes", () => {
    const uncertainty = computeUncertainty({ a: 0.25, b: 0.25, c: 0.25, d: 0.25 });
    expect(uncertainty).toBeCloseTo(1, 5);
  });
});

describe("getLatestModelPrediction", () => {
  it("returns null when no prediction exists yet", async () => {
    const fakeDb = createFakeDb({
      from: { model_predictions: () => ({ data: null, error: null }) },
    });

    const result = await getLatestModelPrediction(fakeDb as never, "report-1");
    expect(result).toBeNull();
  });

  it("returns a DTO with model metadata, uncertainty, and explanations converted from row shape", async () => {
    const fakeDb = createFakeDb({
      from: {
        model_predictions: () => ({ data: PREDICTION_ROW, error: null }),
        model_explanations: () => ({ data: [EXPLANATION_ROW], error: null }),
      },
    });

    const result = await getLatestModelPrediction(fakeDb as never, "report-1");
    expect(result?.qualityScore).toBe(0.9);
    expect(result?.model).toEqual({ version: "v1.2.0", trainedAt: "2026-06-01T00:00:00.000Z", promotedAt: "2026-06-05T00:00:00.000Z" });
    expect(result?.explanations).toHaveLength(1);
    expect(result?.explanations[0]?.explanationType).toBe("occlusion_sensitivity");
    expect(result?.uncertainty).toBeLessThan(0.5);
  });

  it("throws ApiError('internal_error') when the prediction query errors", async () => {
    const fakeDb = createFakeDb({
      from: { model_predictions: () => ({ data: null, error: { message: "connection reset" } }) },
    });

    await expect(getLatestModelPrediction(fakeDb as never, "report-1")).rejects.toMatchObject({
      code: "internal_error",
    });
  });

  it("throws ApiError('internal_error') when the explanations query errors", async () => {
    const fakeDb = createFakeDb({
      from: {
        model_predictions: () => ({ data: PREDICTION_ROW, error: null }),
        model_explanations: () => ({ data: null, error: { message: "connection reset" } }),
      },
    });

    await expect(getLatestModelPrediction(fakeDb as never, "report-1")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("getDuplicateCandidateSummary", () => {
  it("returns null when candidateReportId is null", async () => {
    const fakeDb = createFakeDb({});
    const result = await getDuplicateCandidateSummary(fakeDb as never, null);
    expect(result).toBeNull();
  });

  it("returns a report summary DTO when the candidate is visible", async () => {
    const fakeDb = createFakeDb({
      from: { reports: () => ({ data: REPORT_ROW, error: null }) },
    });

    const result = await getDuplicateCandidateSummary(fakeDb as never, "report-2");
    expect(result?.id).toBe("report-2");
    expect(result?.description).toBe("Kandidat duplikat");
  });

  it("returns null when RLS hides the candidate row (indistinguishable from not found)", async () => {
    const fakeDb = createFakeDb({
      from: { reports: () => ({ data: null, error: null }) },
    });

    const result = await getDuplicateCandidateSummary(fakeDb as never, "report-2");
    expect(result).toBeNull();
  });
});
