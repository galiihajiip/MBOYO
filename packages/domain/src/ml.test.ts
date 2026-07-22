import { describe, expect, it } from "vitest";
import {
  severityProbabilitiesSchema,
  validateImageRequestSchema,
  predictRequestSchema,
  modelInfoSchema,
  qualityChecksSchema,
  predictResponseSchema,
  explainRequestSchema,
  explainResponseSchema,
  batchPredictRequestSchema,
  batchPredictResponseSchema,
  modelInfoResponseSchema,
  readyResponseSchema,
  mlApiErrorResponseSchema,
} from "./ml";

const VALID_PROBABILITIES = {
  unknown: 0.1,
  no_damage: 0.2,
  minor_damage: 0.3,
  major_damage: 0.3,
  destroyed: 0.1,
};

const VALID_MODEL_INFO = {
  version: "1.0.0",
  architecture: "resnet50",
  checksum: "sha256:abc123",
  preprocessingVersion: "1.0.0",
  isAdvisoryOnly: true,
};

const VALID_QUALITY_CHECKS = {
  qualityScore: 0.8,
  passed: true,
  reasons: [] as string[],
};

const REPORT_ID = "11111111-1111-1111-1111-111111111111";

describe("severityProbabilitiesSchema", () => {
  it("accepts a valid probability vector summing to ~1", () => {
    expect(severityProbabilitiesSchema.safeParse(VALID_PROBABILITIES).success).toBe(true);
  });

  it("accepts a vector within the 0.01 sum tolerance", () => {
    const result = severityProbabilitiesSchema.safeParse({
      unknown: 0.1,
      no_damage: 0.2,
      minor_damage: 0.3,
      major_damage: 0.3,
      destroyed: 0.105,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a probability vector that doesn't sum to ~1", () => {
    const result = severityProbabilitiesSchema.safeParse({
      unknown: 0.1,
      no_damage: 0.1,
      minor_damage: 0.1,
      major_damage: 0.1,
      destroyed: 0.1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an out-of-range probability (> 1)", () => {
    const result = severityProbabilitiesSchema.safeParse({ ...VALID_PROBABILITIES, unknown: 1.5 });
    expect(result.success).toBe(false);
  });

  it("rejects a negative probability", () => {
    const result = severityProbabilitiesSchema.safeParse({ ...VALID_PROBABILITIES, unknown: -0.1 });
    expect(result.success).toBe(false);
  });

  it("rejects a payload missing a required severity class key", () => {
    const { destroyed: _omit, ...incomplete } = VALID_PROBABILITIES;
    const result = severityProbabilitiesSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });

  it("rejects an unknown/extra key silently passing as a substitute for a required one", () => {
    const { destroyed: _omit, ...withoutDestroyed } = VALID_PROBABILITIES;
    const result = severityProbabilitiesSchema.safeParse({ ...withoutDestroyed, extra_class: 0.1 });
    expect(result.success).toBe(false);
  });
});

describe("validateImageRequestSchema", () => {
  it("accepts a valid request", () => {
    expect(
      validateImageRequestSchema.safeParse({ imageBase64: "abc123", mimeType: "image/jpeg" }).success,
    ).toBe(true);
  });

  it("rejects an empty imageBase64", () => {
    expect(validateImageRequestSchema.safeParse({ imageBase64: "", mimeType: "image/jpeg" }).success).toBe(false);
  });

  it("rejects a missing mimeType", () => {
    expect(validateImageRequestSchema.safeParse({ imageBase64: "abc123" }).success).toBe(false);
  });
});

describe("predictRequestSchema", () => {
  it("accepts a valid request", () => {
    const result = predictRequestSchema.safeParse({
      reportId: REPORT_ID,
      imageBase64: "abc123",
      mimeType: "image/jpeg",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-UUID reportId", () => {
    const result = predictRequestSchema.safeParse({
      reportId: "not-a-uuid",
      imageBase64: "abc123",
      mimeType: "image/jpeg",
    });
    expect(result.success).toBe(false);
  });
});

describe("modelInfoSchema", () => {
  it("accepts a valid model info payload", () => {
    expect(modelInfoSchema.safeParse(VALID_MODEL_INFO).success).toBe(true);
  });

  it("rejects a missing checksum", () => {
    const { checksum: _omit, ...withoutChecksum } = VALID_MODEL_INFO;
    expect(modelInfoSchema.safeParse(withoutChecksum).success).toBe(false);
  });
});

describe("qualityChecksSchema", () => {
  it("accepts a valid quality-checks payload", () => {
    expect(qualityChecksSchema.safeParse(VALID_QUALITY_CHECKS).success).toBe(true);
  });

  it("rejects a qualityScore outside [0, 1]", () => {
    expect(qualityChecksSchema.safeParse({ ...VALID_QUALITY_CHECKS, qualityScore: 1.2 }).success).toBe(false);
  });
});

describe("predictResponseSchema", () => {
  const validResponse = {
    prediction: "minor_damage",
    calibratedProbabilities: VALID_PROBABILITIES,
    confidence: 0.7,
    entropy: 0.5,
    abstained: false,
    abstentionReasons: [] as string[],
    qualityChecks: VALID_QUALITY_CHECKS,
    model: VALID_MODEL_INFO,
    latencyMs: 120,
    explanationRef: null,
    disclaimer: "AI advisory only, not authoritative.",
    isDemoFallback: false,
    requestId: "req-1",
  };

  it("accepts a valid full prediction response", () => {
    expect(predictResponseSchema.safeParse(validResponse).success).toBe(true);
  });

  it("rejects a prediction outside the SEVERITY_CLASSES enum", () => {
    expect(predictResponseSchema.safeParse({ ...validResponse, prediction: "catastrophic" }).success).toBe(false);
  });

  it("rejects malformed nested calibratedProbabilities (doesn't sum to ~1)", () => {
    const badProbabilities = { unknown: 0, no_damage: 0, minor_damage: 0, major_damage: 0, destroyed: 0 };
    expect(
      predictResponseSchema.safeParse({ ...validResponse, calibratedProbabilities: badProbabilities }).success,
    ).toBe(false);
  });

  it("rejects a negative entropy", () => {
    expect(predictResponseSchema.safeParse({ ...validResponse, entropy: -1 }).success).toBe(false);
  });

  it("rejects a confidence outside [0, 1]", () => {
    expect(predictResponseSchema.safeParse({ ...validResponse, confidence: 1.1 }).success).toBe(false);
  });

  it("accepts a null explanationRef", () => {
    expect(predictResponseSchema.safeParse({ ...validResponse, explanationRef: null }).success).toBe(true);
  });

  it("rejects a missing disclaimer field", () => {
    const { disclaimer: _omit, ...withoutDisclaimer } = validResponse;
    expect(predictResponseSchema.safeParse(withoutDisclaimer).success).toBe(false);
  });
});

describe("explainRequestSchema", () => {
  it("accepts a valid request without an optional targetClass", () => {
    const result = explainRequestSchema.safeParse({ reportId: REPORT_ID, imageBase64: "abc", mimeType: "image/jpeg" });
    expect(result.success).toBe(true);
  });

  it("accepts a valid request with an optional targetClass", () => {
    const result = explainRequestSchema.safeParse({
      reportId: REPORT_ID,
      imageBase64: "abc",
      mimeType: "image/jpeg",
      targetClass: "destroyed",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid targetClass", () => {
    const result = explainRequestSchema.safeParse({
      reportId: REPORT_ID,
      imageBase64: "abc",
      mimeType: "image/jpeg",
      targetClass: "not_a_class",
    });
    expect(result.success).toBe(false);
  });
});

describe("explainResponseSchema", () => {
  it("accepts a valid explain response", () => {
    const result = explainResponseSchema.safeParse({
      heatmapPngBase64: "base64data",
      targetClass: "destroyed",
      disclaimer: "AI advisory only.",
      model: VALID_MODEL_INFO,
      latencyMs: 200,
      requestId: "req-1",
    });
    expect(result.success).toBe(true);
  });
});

describe("batchPredictRequestSchema", () => {
  const item = { reportId: REPORT_ID, imageBase64: "abc", mimeType: "image/jpeg" };

  it("accepts between 1 and 16 items", () => {
    expect(batchPredictRequestSchema.safeParse({ items: [item] }).success).toBe(true);
    expect(batchPredictRequestSchema.safeParse({ items: Array(16).fill(item) }).success).toBe(true);
  });

  it("rejects an empty items array", () => {
    expect(batchPredictRequestSchema.safeParse({ items: [] }).success).toBe(false);
  });

  it("rejects more than 16 items", () => {
    expect(batchPredictRequestSchema.safeParse({ items: Array(17).fill(item) }).success).toBe(false);
  });
});

describe("batchPredictResponseSchema", () => {
  it("accepts a discriminated union of ok and failed results", () => {
    const result = batchPredictResponseSchema.safeParse({
      results: [
        {
          ok: true,
          reportId: REPORT_ID,
          result: {
            prediction: "minor_damage",
            calibratedProbabilities: VALID_PROBABILITIES,
            confidence: 0.7,
            entropy: 0.5,
            abstained: false,
            abstentionReasons: [],
            qualityChecks: VALID_QUALITY_CHECKS,
            model: VALID_MODEL_INFO,
            latencyMs: 120,
            explanationRef: null,
            disclaimer: "AI advisory only.",
            isDemoFallback: false,
            requestId: "req-1",
          },
        },
        { ok: false, reportId: REPORT_ID, error: "decode failed" },
      ],
      requestId: "req-1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a failed-result entry missing its error field", () => {
    const result = batchPredictResponseSchema.safeParse({
      results: [{ ok: false, reportId: REPORT_ID }],
      requestId: "req-1",
    });
    expect(result.success).toBe(false);
  });
});

describe("modelInfoResponseSchema", () => {
  it("accepts a valid response", () => {
    const result = modelInfoResponseSchema.safeParse({
      model: VALID_MODEL_INFO,
      loadedAt: new Date().toISOString(),
      requestId: "req-1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-datetime loadedAt", () => {
    const result = modelInfoResponseSchema.safeParse({
      model: VALID_MODEL_INFO,
      loadedAt: "not-a-date",
      requestId: "req-1",
    });
    expect(result.success).toBe(false);
  });
});

describe("readyResponseSchema", () => {
  it("accepts ready: true with a null reason", () => {
    expect(readyResponseSchema.safeParse({ ready: true, reason: null, requestId: "req-1" }).success).toBe(true);
  });

  it("accepts ready: false with a reason string", () => {
    expect(readyResponseSchema.safeParse({ ready: false, reason: "model not loaded", requestId: "req-1" }).success).toBe(
      true,
    );
  });
});

describe("mlApiErrorResponseSchema", () => {
  it("accepts a valid structured error envelope", () => {
    const result = mlApiErrorResponseSchema.safeParse({
      ok: false,
      error: { code: "decode_failed", message: "Berkas rusak" },
      requestId: "req-1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects ok: true (this schema is specifically the failure envelope)", () => {
    const result = mlApiErrorResponseSchema.safeParse({
      ok: true,
      error: { code: "decode_failed", message: "Berkas rusak" },
      requestId: "req-1",
    });
    expect(result.success).toBe(false);
  });
});
