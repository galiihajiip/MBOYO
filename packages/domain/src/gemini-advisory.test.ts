import { describe, expect, it } from "vitest";
import {
  requestGeminiAdvisorySchema,
  geminiStructuredOutputSchema,
  geminiAdvisoryResponseSchema,
  GEMINI_ADVISORY_UI_LABEL,
} from "./gemini-advisory";

describe("requestGeminiAdvisorySchema", () => {
  it("accepts a valid payload with imageDisclosureLevel defaulting to 'none'", () => {
    const parsed = requestGeminiAdvisorySchema.parse({ consentAccepted: true, externalDisclosureAccepted: true });
    expect(parsed.imageDisclosureLevel).toBe("none");
  });

  it("rejects consentAccepted: false", () => {
    expect(() =>
      requestGeminiAdvisorySchema.parse({ consentAccepted: false, externalDisclosureAccepted: true }),
    ).toThrow();
  });

  it("rejects externalDisclosureAccepted: false", () => {
    expect(() =>
      requestGeminiAdvisorySchema.parse({ consentAccepted: true, externalDisclosureAccepted: false }),
    ).toThrow();
  });

  it("rejects a missing consentAccepted field entirely", () => {
    expect(() => requestGeminiAdvisorySchema.parse({ externalDisclosureAccepted: true })).toThrow();
  });

  it("accepts an explicit imageDisclosureLevel of 'raw_image'", () => {
    const parsed = requestGeminiAdvisorySchema.parse({
      imageDisclosureLevel: "raw_image",
      consentAccepted: true,
      externalDisclosureAccepted: true,
    });
    expect(parsed.imageDisclosureLevel).toBe("raw_image");
  });

  it("rejects an unrecognized imageDisclosureLevel", () => {
    expect(() =>
      requestGeminiAdvisorySchema.parse({
        imageDisclosureLevel: "full_resolution_uncompressed",
        consentAccepted: true,
        externalDisclosureAccepted: true,
      }),
    ).toThrow();
  });
});

describe("geminiStructuredOutputSchema", () => {
  const VALID = {
    evidenceSummary: "A damaged roof is visible in the photo.",
    suggestedFollowUpQuestion: "When did this damage occur?",
    nonBindingHypothesis: "Possible storm damage.",
    qualityObservations: ["Slightly blurry", "Taken at dusk"],
  };

  it("accepts a fully-populated valid response", () => {
    expect(() => geminiStructuredOutputSchema.parse(VALID)).not.toThrow();
  });

  it("accepts null for suggestedFollowUpQuestion and nonBindingHypothesis", () => {
    const parsed = geminiStructuredOutputSchema.parse({
      ...VALID,
      suggestedFollowUpQuestion: null,
      nonBindingHypothesis: null,
    });
    expect(parsed.suggestedFollowUpQuestion).toBeNull();
    expect(parsed.nonBindingHypothesis).toBeNull();
  });

  it("rejects an evidenceSummary over 1000 characters (bounding a malformed/injected response)", () => {
    expect(() => geminiStructuredOutputSchema.parse({ ...VALID, evidenceSummary: "a".repeat(1001) })).toThrow();
  });

  it("rejects more than 5 quality observations", () => {
    expect(() =>
      geminiStructuredOutputSchema.parse({ ...VALID, qualityObservations: Array(6).fill("observation") }),
    ).toThrow();
  });

  it("rejects a response missing required fields (e.g. a model that ignores the schema)", () => {
    expect(() => geminiStructuredOutputSchema.parse({ evidenceSummary: "only this field" })).toThrow();
  });

  it("rejects an unexpected field shape entirely (defends against a model returning a different structure)", () => {
    expect(() =>
      geminiStructuredOutputSchema.parse({ chainOfThought: "step 1... step 2...", answer: "destroyed" }),
    ).toThrow();
  });
});

describe("geminiAdvisoryResponseSchema", () => {
  it("accepts a complete succeeded response", () => {
    const parsed = geminiAdvisoryResponseSchema.parse({
      id: "11111111-1111-1111-1111-111111111111",
      reportId: "22222222-2222-2222-2222-222222222222",
      status: "succeeded",
      imageDisclosureLevel: "none",
      structuredOutput: {
        evidenceSummary: "test",
        suggestedFollowUpQuestion: null,
        nonBindingHypothesis: null,
        qualityObservations: [],
      },
      errorMessage: null,
      modelName: "gemini-2.0-flash",
      latencyMs: 500,
      retryCount: 0,
      createdAt: "2026-07-20T00:00:00.000Z",
      disclaimerLabel: GEMINI_ADVISORY_UI_LABEL,
    });
    expect(parsed.status).toBe("succeeded");
  });

  it("accepts a failed response with structuredOutput null", () => {
    expect(() =>
      geminiAdvisoryResponseSchema.parse({
        id: "11111111-1111-1111-1111-111111111111",
        reportId: "22222222-2222-2222-2222-222222222222",
        status: "failed",
        imageDisclosureLevel: "none",
        structuredOutput: null,
        errorMessage: "Timed out",
        modelName: "gemini-2.0-flash",
        latencyMs: 0,
        retryCount: 2,
        createdAt: "2026-07-20T00:00:00.000Z",
        disclaimerLabel: GEMINI_ADVISORY_UI_LABEL,
      }),
    ).not.toThrow();
  });

  it("rejects a negative latencyMs", () => {
    expect(() =>
      geminiAdvisoryResponseSchema.parse({
        id: "11111111-1111-1111-1111-111111111111",
        reportId: "22222222-2222-2222-2222-222222222222",
        status: "succeeded",
        imageDisclosureLevel: "none",
        structuredOutput: null,
        errorMessage: null,
        modelName: "gemini-2.0-flash",
        latencyMs: -1,
        retryCount: 0,
        createdAt: "2026-07-20T00:00:00.000Z",
        disclaimerLabel: GEMINI_ADVISORY_UI_LABEL,
      }),
    ).toThrow();
  });
});

describe("GEMINI_ADVISORY_UI_LABEL", () => {
  it("is the exact required verbatim string", () => {
    expect(GEMINI_ADVISORY_UI_LABEL).toBe("Analisis Tambahan Eksternal — Tidak Menentukan Keputusan Resmi");
  });
});
