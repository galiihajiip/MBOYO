import { describe, expect, it } from "vitest";
import {
  createReportSchema,
  reportListFiltersSchema,
  submitVerificationDecisionSchema,
  archiveReportSchema,
  submitLocationObservationSchema,
} from "./reports";

describe("createReportSchema", () => {
  it("accepts a valid minimal payload and defaults description to an empty string", () => {
    const parsed = createReportSchema.parse({
      clientReportId: "11111111-1111-1111-1111-111111111111",
      eventId: "22222222-2222-2222-2222-222222222222",
    });
    expect(parsed.description).toBe("");
  });

  it("rejects a non-uuid clientReportId", () => {
    expect(() =>
      createReportSchema.parse({ clientReportId: "not-a-uuid", eventId: "22222222-2222-2222-2222-222222222222" }),
    ).toThrow();
  });

  it("rejects a description over 4000 characters", () => {
    expect(() =>
      createReportSchema.parse({
        clientReportId: "11111111-1111-1111-1111-111111111111",
        eventId: "22222222-2222-2222-2222-222222222222",
        description: "a".repeat(4001),
      }),
    ).toThrow();
  });
});

describe("reportListFiltersSchema", () => {
  it("accepts an empty filter set", () => {
    expect(reportListFiltersSchema.parse({})).toEqual({});
  });

  it("rejects a status value outside REPORT_STATUSES", () => {
    expect(() => reportListFiltersSchema.parse({ status: "not_a_real_status" })).toThrow();
  });

  it("accepts a valid status", () => {
    expect(reportListFiltersSchema.parse({ status: "verified" }).status).toBe("verified");
  });

  it("accepts every BLOCK 23 queue filter together", () => {
    const parsed = reportListFiltersSchema.parse({
      predictedSeverity: "destroyed",
      minConfidence: 0.3,
      maxConfidence: 0.6,
      maxQualityScore: 0.5,
      hasDuplicateCandidate: true,
      maxGpsAccuracyMeters: 100,
      minAgeHours: 24,
      escalatedOnly: true,
      reviewedByVerifierProfileId: "11111111-1111-1111-1111-111111111111",
    });
    expect(parsed.escalatedOnly).toBe(true);
    expect(parsed.minConfidence).toBe(0.3);
  });

  it("rejects a confidence value outside 0..1", () => {
    expect(() => reportListFiltersSchema.parse({ minConfidence: 1.5 })).toThrow();
    expect(() => reportListFiltersSchema.parse({ minConfidence: -0.1 })).toThrow();
  });

  it("rejects a negative maxGpsAccuracyMeters or minAgeHours", () => {
    expect(() => reportListFiltersSchema.parse({ maxGpsAccuracyMeters: -1 })).toThrow();
    expect(() => reportListFiltersSchema.parse({ minAgeHours: -1 })).toThrow();
  });
});

describe("submitVerificationDecisionSchema", () => {
  it("accepts a confirm decision with no overrideSeverity", () => {
    expect(submitVerificationDecisionSchema.parse({ decision: "confirm" }).decision).toBe("confirm");
  });

  it("rejects an override decision missing overrideSeverity", () => {
    const result = submitVerificationDecisionSchema.safeParse({ decision: "override" });
    expect(result.success).toBe(false);
  });

  it("accepts an override decision with overrideSeverity and notes", () => {
    const result = submitVerificationDecisionSchema.safeParse({
      decision: "override",
      overrideSeverity: "destroyed",
      notes: "Foto menunjukkan kerusakan lebih parah dari prediksi model.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-override decision that includes overrideSeverity", () => {
    const result = submitVerificationDecisionSchema.safeParse({ decision: "confirm", overrideSeverity: "destroyed" });
    expect(result.success).toBe(false);
  });

  it("rejects an unrecognized decision value", () => {
    expect(() => submitVerificationDecisionSchema.parse({ decision: "not_a_real_decision" })).toThrow();
  });

  it("accepts insufficient_evidence with notes", () => {
    const result = submitVerificationDecisionSchema.safeParse({
      decision: "insufficient_evidence",
      notes: "Foto terlalu buram untuk dinilai.",
    });
    expect(result.success).toBe(true);
  });

  it("requires notes for override, reject, and escalate but not confirm or insufficient_evidence", () => {
    expect(
      submitVerificationDecisionSchema.safeParse({
        decision: "override",
        overrideSeverity: "destroyed",
      }).success,
    ).toBe(false);
    expect(
      submitVerificationDecisionSchema.safeParse({
        decision: "reject",
        rejectReasonCategory: "duplicate_report",
      }).success,
    ).toBe(false);
    expect(submitVerificationDecisionSchema.safeParse({ decision: "escalate" }).success).toBe(false);
    expect(submitVerificationDecisionSchema.safeParse({ decision: "confirm" }).success).toBe(true);
  });

  it("requires rejectReasonCategory for reject decisions", () => {
    const result = submitVerificationDecisionSchema.safeParse({
      decision: "reject",
      notes: "Laporan ini duplikat.",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a reject decision with rejectReasonCategory and notes", () => {
    const result = submitVerificationDecisionSchema.safeParse({
      decision: "reject",
      rejectReasonCategory: "duplicate_report",
      notes: "Sama dengan laporan #123.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects rejectReasonCategory on a non-reject decision", () => {
    const result = submitVerificationDecisionSchema.safeParse({
      decision: "confirm",
      rejectReasonCategory: "other",
    });
    expect(result.success).toBe(false);
  });
});

describe("archiveReportSchema", () => {
  it("accepts an empty payload (reason is optional)", () => {
    expect(archiveReportSchema.parse({})).toEqual({});
  });

  it("accepts a reason under the length limit", () => {
    expect(archiveReportSchema.parse({ reason: "retention period elapsed" }).reason).toBe(
      "retention period elapsed",
    );
  });

  it("rejects a reason over 1000 characters", () => {
    expect(() => archiveReportSchema.parse({ reason: "a".repeat(1001) })).toThrow();
  });
});

describe("submitLocationObservationSchema", () => {
  const validGps = { longitude: 106.827, latitude: -6.175, source: "gps" as const };

  it("accepts a valid GPS observation", () => {
    const result = submitLocationObservationSchema.safeParse(validGps);
    expect(result.success).toBe(true);
  });

  it("rejects longitude outside [-180, 180]", () => {
    expect(submitLocationObservationSchema.safeParse({ ...validGps, longitude: 181 }).success).toBe(false);
    expect(submitLocationObservationSchema.safeParse({ ...validGps, longitude: -181 }).success).toBe(false);
  });

  it("rejects latitude outside [-90, 90]", () => {
    expect(submitLocationObservationSchema.safeParse({ ...validGps, latitude: 91 }).success).toBe(false);
    expect(submitLocationObservationSchema.safeParse({ ...validGps, latitude: -91 }).success).toBe(false);
  });

  it("accepts boundary values -180/180 and -90/90", () => {
    expect(submitLocationObservationSchema.safeParse({ ...validGps, longitude: 180, latitude: 90 }).success).toBe(
      true,
    );
    expect(submitLocationObservationSchema.safeParse({ ...validGps, longitude: -180, latitude: -90 }).success).toBe(
      true,
    );
  });

  it("rejects a non-positive accuracyMeters", () => {
    expect(submitLocationObservationSchema.safeParse({ ...validGps, accuracyMeters: 0 }).success).toBe(false);
    expect(submitLocationObservationSchema.safeParse({ ...validGps, accuracyMeters: -5 }).success).toBe(false);
  });

  it("rejects source manual_address with no manualAddress given", () => {
    const result = submitLocationObservationSchema.safeParse({
      longitude: 106.827,
      latitude: -6.175,
      source: "manual_address",
    });
    expect(result.success).toBe(false);
  });

  it("rejects source manual_address with a blank/whitespace-only manualAddress", () => {
    const result = submitLocationObservationSchema.safeParse({
      longitude: 106.827,
      latitude: -6.175,
      source: "manual_address",
      manualAddress: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("accepts source manual_address with a real manualAddress", () => {
    const result = submitLocationObservationSchema.safeParse({
      longitude: 106.827,
      latitude: -6.175,
      source: "manual_address",
      manualAddress: "Jl. Merdeka No. 1",
    });
    expect(result.success).toBe(true);
  });

  it("accepts source manual_pin with no manualAddress", () => {
    const result = submitLocationObservationSchema.safeParse({
      longitude: 106.827,
      latitude: -6.175,
      source: "manual_pin",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unrecognized source value", () => {
    expect(() =>
      submitLocationObservationSchema.parse({ longitude: 1, latitude: 1, source: "not_a_real_source" }),
    ).toThrow();
  });
});
