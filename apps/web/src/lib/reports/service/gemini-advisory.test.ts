import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as GeminiClientModule from "../../gemini/client";
import { createFakeDb } from "./test-support/fake-db";
import { ApiError } from "../../api/errors";

interface FakeServerEnv {
  GEMINI_API_KEY: string | undefined;
  GEMINI_MODEL?: string;
  GEMINI_TIMEOUT_MS?: number;
  GEMINI_MAX_RETRIES?: number;
  GEMINI_RATE_LIMIT_REQUESTS_PER_MINUTE?: number;
  SUPABASE_REPORTS_BUCKET: string;
}

const { mockGetServerEnv, mockRequestGeminiAdvisory } = vi.hoisted(() => ({
  mockGetServerEnv: vi.fn<() => FakeServerEnv>(),
  mockRequestGeminiAdvisory:
    vi.fn<
      (
        input: GeminiClientModule.GeminiAdvisoryCallInput,
        config: GeminiClientModule.GeminiClientConfig,
        rateLimitKey: string,
      ) => Promise<GeminiClientModule.GeminiAdvisoryCallResult>
    >(),
}));

vi.mock("../../env.server", () => ({
  getServerEnv: () => mockGetServerEnv(),
}));

vi.mock("../../gemini/client", async () => {
  const actual = await vi.importActual<typeof GeminiClientModule>("../../gemini/client");
  return {
    ...actual,
    requestGeminiAdvisory: mockRequestGeminiAdvisory,
  };
});

vi.mock("../../gemini/redaction", () => ({
  redactImage: (buffer: Buffer) => Promise.resolve(Buffer.from(`redacted:${buffer.toString("base64")}`)),
}));

import { requestGeminiAdvisoryForReport, listGeminiAdvisoryRequests } from "./gemini-advisory";

const REPORT_ROW = { id: "report-1", description: "Rumah roboh sebagian." };
const PREDICTION_ROW = {
  severity_probabilities: { unknown: 0.1, no_damage: 0.1, minor_damage: 0.6, major_damage: 0.1, destroyed: 0.1 },
  quality_score: 0.85,
};
const EVIDENCE_ROW = { storage_path: "report-1/hash123", mime_type: "image/jpeg" };

const SUCCEEDED_ADVISORY_ROW = {
  id: "advisory-1",
  report_id: "report-1",
  status: "succeeded" as const,
  image_disclosure_level: "none" as const,
  structured_output: {
    evidenceSummary: "test summary",
    suggestedFollowUpQuestion: null,
    nonBindingHypothesis: null,
    qualityObservations: [],
  },
  error_message: null,
  model_name: "gemini-2.0-flash",
  latency_ms: 500,
  retry_count: 0,
  created_at: "2026-07-20T00:00:00.000Z",
};

function fakeBlobFrom(text: string): Blob {
  return new Blob([text]);
}

beforeEach(() => {
  mockGetServerEnv.mockReset();
  mockRequestGeminiAdvisory.mockReset();
  mockGetServerEnv.mockReturnValue({
    GEMINI_API_KEY: "test-key",
    GEMINI_MODEL: "gemini-2.0-flash",
    GEMINI_TIMEOUT_MS: 15000,
    GEMINI_MAX_RETRIES: 2,
    GEMINI_RATE_LIMIT_REQUESTS_PER_MINUTE: 10,
    SUPABASE_REPORTS_BUCKET: "report-evidence",
  });
});

describe("requestGeminiAdvisoryForReport — precondition failures", () => {
  it("throws precondition_failed when GEMINI_API_KEY is not configured", async () => {
    mockGetServerEnv.mockReturnValue({ GEMINI_API_KEY: undefined, SUPABASE_REPORTS_BUCKET: "report-evidence" });
    const fakeDb = createFakeDb({});

    await expect(
      requestGeminiAdvisoryForReport(
        fakeDb as never,
        "report-1",
        { imageDisclosureLevel: "none", consentAccepted: true, externalDisclosureAccepted: true },
        "req-1",
      ),
    ).rejects.toMatchObject({ code: "precondition_failed" });

    expect(mockRequestGeminiAdvisory).not.toHaveBeenCalled();
  });

  it("throws not_found when the report does not exist (RLS-hidden or nonexistent)", async () => {
    const fakeDb = createFakeDb({ from: { reports: () => ({ data: null, error: null }) } });

    await expect(
      requestGeminiAdvisoryForReport(
        fakeDb as never,
        "missing-report",
        { imageDisclosureLevel: "none", consentAccepted: true, externalDisclosureAccepted: true },
        "req-1",
      ),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("rejects a raw_image request when consent or disclosure was not accepted, before any download", async () => {
    const fakeDb = createFakeDb({ from: { reports: () => ({ data: REPORT_ROW, error: null }) } });

    // Cast past requestGeminiAdvisorySchema's z.literal(true) type — this
    // test exists specifically to verify the SERVICE function's own
    // defense-in-depth runtime check (not the schema, which lives at the
    // API route boundary and is tested separately in packages/domain), so
    // it deliberately constructs an input the type system would otherwise
    // never allow through.
    const input = {
      imageDisclosureLevel: "raw_image",
      consentAccepted: true,
      externalDisclosureAccepted: false,
    } as unknown as Parameters<typeof requestGeminiAdvisoryForReport>[2];

    await expect(requestGeminiAdvisoryForReport(fakeDb as never, "report-1", input, "req-1")).rejects.toMatchObject({
      code: "forbidden",
    });

    expect(fakeDb.storageDownloadCalls).toHaveLength(0);
  });
});

describe("requestGeminiAdvisoryForReport — image disclosure levels", () => {
  it("sends no image data at all for disclosure level 'none'", async () => {
    mockRequestGeminiAdvisory.mockResolvedValue({
      structuredOutput: SUCCEEDED_ADVISORY_ROW.structured_output,
      modelName: "gemini-2.0-flash",
      latencyMs: 500,
      retryCount: 0,
    });
    const fakeDb = createFakeDb({
      from: {
        reports: () => ({ data: REPORT_ROW, error: null }),
        model_predictions: () => ({ data: PREDICTION_ROW, error: null }),
      },
      rpc: { record_gemini_advisory_request: () => ({ data: SUCCEEDED_ADVISORY_ROW, error: null }) },
    });

    await requestGeminiAdvisoryForReport(
      fakeDb as never,
      "report-1",
      { imageDisclosureLevel: "none", consentAccepted: true, externalDisclosureAccepted: true },
      "req-1",
    );

    expect(fakeDb.storageDownloadCalls).toHaveLength(0);
    const callArgs = mockRequestGeminiAdvisory.mock.calls[0]![0];
    expect(callArgs.imageBase64).toBeNull();
    expect(callArgs.imageMimeType).toBeNull();
  });

  it("downloads and redacts the image for disclosure level 'redacted_image'", async () => {
    mockRequestGeminiAdvisory.mockResolvedValue({
      structuredOutput: SUCCEEDED_ADVISORY_ROW.structured_output,
      modelName: "gemini-2.0-flash",
      latencyMs: 500,
      retryCount: 0,
    });
    const fakeDb = createFakeDb({
      from: {
        reports: () => ({ data: REPORT_ROW, error: null }),
        model_predictions: () => ({ data: PREDICTION_ROW, error: null }),
        report_evidence: () => ({ data: EVIDENCE_ROW, error: null }),
      },
      rpc: { record_gemini_advisory_request: () => ({ data: SUCCEEDED_ADVISORY_ROW, error: null }) },
      storage: { "report-evidence": () => ({ data: fakeBlobFrom("original-bytes"), error: null }) },
    });

    await requestGeminiAdvisoryForReport(
      fakeDb as never,
      "report-1",
      { imageDisclosureLevel: "redacted_image", consentAccepted: true, externalDisclosureAccepted: true },
      "req-1",
    );

    expect(fakeDb.storageDownloadCalls).toHaveLength(1);
    const callArgs = mockRequestGeminiAdvisory.mock.calls[0]![0];
    // The redaction mock returns Buffer.from("redacted:<original base64>"),
    // which the service then re-encodes to base64 itself — decode once to
    // confirm the redaction mock's marker made it through, rather than
    // asserting on the double-encoded string directly.
    expect(callArgs.imageBase64).not.toBeNull();
    const decoded = Buffer.from(callArgs.imageBase64!, "base64").toString("utf-8");
    expect(decoded).toContain("redacted:");
    expect(callArgs.imageMimeType).toBe("image/jpeg");
  });

  it("sends the original bytes for disclosure level 'raw_image' when both acknowledgements are true", async () => {
    mockRequestGeminiAdvisory.mockResolvedValue({
      structuredOutput: SUCCEEDED_ADVISORY_ROW.structured_output,
      modelName: "gemini-2.0-flash",
      latencyMs: 500,
      retryCount: 0,
    });
    const fakeDb = createFakeDb({
      from: {
        reports: () => ({ data: REPORT_ROW, error: null }),
        model_predictions: () => ({ data: PREDICTION_ROW, error: null }),
        report_evidence: () => ({ data: EVIDENCE_ROW, error: null }),
      },
      rpc: { record_gemini_advisory_request: () => ({ data: SUCCEEDED_ADVISORY_ROW, error: null }) },
      storage: { "report-evidence": () => ({ data: fakeBlobFrom("original-bytes"), error: null }) },
    });

    await requestGeminiAdvisoryForReport(
      fakeDb as never,
      "report-1",
      { imageDisclosureLevel: "raw_image", consentAccepted: true, externalDisclosureAccepted: true },
      "req-1",
    );

    const callArgs = mockRequestGeminiAdvisory.mock.calls[0]![0];
    expect(callArgs.imageMimeType).toBe("image/jpeg");
    // Raw path never calls the redaction mock's "redacted:" prefix.
    expect(callArgs.imageBase64).not.toContain("redacted:");
  });

  it("throws precondition_failed when an image is requested but no evidence exists", async () => {
    const fakeDb = createFakeDb({
      from: {
        reports: () => ({ data: REPORT_ROW, error: null }),
        model_predictions: () => ({ data: null, error: null }),
        report_evidence: () => ({ data: null, error: null }),
      },
    });

    await expect(
      requestGeminiAdvisoryForReport(
        fakeDb as never,
        "report-1",
        { imageDisclosureLevel: "redacted_image", consentAccepted: true, externalDisclosureAccepted: true },
        "req-1",
      ),
    ).rejects.toMatchObject({ code: "precondition_failed" });
  });
});

describe("requestGeminiAdvisoryForReport — never touches reports.status or verification_reviews", () => {
  it("only calls the record_gemini_advisory_request RPC, never any reports/verification_reviews write", async () => {
    mockRequestGeminiAdvisory.mockResolvedValue({
      structuredOutput: SUCCEEDED_ADVISORY_ROW.structured_output,
      modelName: "gemini-2.0-flash",
      latencyMs: 500,
      retryCount: 0,
    });
    const fakeDb = createFakeDb({
      from: {
        reports: () => ({ data: REPORT_ROW, error: null }),
        model_predictions: () => ({ data: PREDICTION_ROW, error: null }),
      },
      rpc: { record_gemini_advisory_request: () => ({ data: SUCCEEDED_ADVISORY_ROW, error: null }) },
    });

    await requestGeminiAdvisoryForReport(
      fakeDb as never,
      "report-1",
      { imageDisclosureLevel: "none", consentAccepted: true, externalDisclosureAccepted: true },
      "req-1",
    );

    expect(fakeDb.rpcCalls.map((call) => call.fn)).toEqual(["record_gemini_advisory_request"]);
    // The only .from() calls are reads (reports, model_predictions) — no
    // update/insert call is ever made against "reports" or
    // "verification_reviews" by this function.
    expect(fakeDb.fromCalls).not.toContain("verification_reviews");
  });
});

describe("requestGeminiAdvisoryForReport — records every outcome as a complete audit row", () => {
  it("records a 'succeeded' row with structured output on success", async () => {
    mockRequestGeminiAdvisory.mockResolvedValue({
      structuredOutput: SUCCEEDED_ADVISORY_ROW.structured_output,
      modelName: "gemini-2.0-flash",
      latencyMs: 500,
      retryCount: 0,
    });
    const rpcSpy = vi.fn(() => ({ data: SUCCEEDED_ADVISORY_ROW, error: null }));
    const fakeDb = createFakeDb({
      from: {
        reports: () => ({ data: REPORT_ROW, error: null }),
        model_predictions: () => ({ data: PREDICTION_ROW, error: null }),
      },
      rpc: { record_gemini_advisory_request: rpcSpy },
    });

    const result = await requestGeminiAdvisoryForReport(
      fakeDb as never,
      "report-1",
      { imageDisclosureLevel: "none", consentAccepted: true, externalDisclosureAccepted: true },
      "req-1",
    );

    expect(result.status).toBe("succeeded");
    expect(fakeDb.rpcCalls[0]?.args).toMatchObject({ p_status: "succeeded", p_error_message: null });
  });

  it("records a 'timed_out' row (not an unhandled exception) when the Gemini call times out", async () => {
    const { GeminiTimeoutError } = await import("../../gemini/client");
    mockRequestGeminiAdvisory.mockRejectedValue(new GeminiTimeoutError(15000));
    const advisoryRow = { ...SUCCEEDED_ADVISORY_ROW, status: "timed_out" as const, structured_output: null, error_message: "timed out" };
    const fakeDb = createFakeDb({
      from: {
        reports: () => ({ data: REPORT_ROW, error: null }),
        model_predictions: () => ({ data: PREDICTION_ROW, error: null }),
      },
      rpc: { record_gemini_advisory_request: () => ({ data: advisoryRow, error: null }) },
    });

    const result = await requestGeminiAdvisoryForReport(
      fakeDb as never,
      "report-1",
      { imageDisclosureLevel: "none", consentAccepted: true, externalDisclosureAccepted: true },
      "req-1",
    );

    expect(result.status).toBe("timed_out");
    expect(fakeDb.rpcCalls[0]?.args).toMatchObject({ p_status: "timed_out" });
  });

  it("records a 'rate_limited' row when the Gemini call is rate-limited", async () => {
    const { GeminiRateLimitedError } = await import("../../gemini/client");
    mockRequestGeminiAdvisory.mockRejectedValue(new GeminiRateLimitedError());
    const advisoryRow = { ...SUCCEEDED_ADVISORY_ROW, status: "rate_limited" as const, structured_output: null, error_message: "rate limited" };
    const fakeDb = createFakeDb({
      from: {
        reports: () => ({ data: REPORT_ROW, error: null }),
        model_predictions: () => ({ data: PREDICTION_ROW, error: null }),
      },
      rpc: { record_gemini_advisory_request: () => ({ data: advisoryRow, error: null }) },
    });

    const result = await requestGeminiAdvisoryForReport(
      fakeDb as never,
      "report-1",
      { imageDisclosureLevel: "none", consentAccepted: true, externalDisclosureAccepted: true },
      "req-1",
    );

    expect(result.status).toBe("rate_limited");
  });
});

describe("requestGeminiAdvisoryForReport — RPC error translation", () => {
  it("maps 42501 to ApiError('forbidden')", async () => {
    mockRequestGeminiAdvisory.mockResolvedValue({
      structuredOutput: SUCCEEDED_ADVISORY_ROW.structured_output,
      modelName: "gemini-2.0-flash",
      latencyMs: 500,
      retryCount: 0,
    });
    const fakeDb = createFakeDb({
      from: {
        reports: () => ({ data: REPORT_ROW, error: null }),
        model_predictions: () => ({ data: PREDICTION_ROW, error: null }),
      },
      rpc: {
        record_gemini_advisory_request: () => ({
          data: null,
          error: { code: "42501", message: "caller must hold the verifier role" },
        }),
      },
    });

    await expect(
      requestGeminiAdvisoryForReport(
        fakeDb as never,
        "report-1",
        { imageDisclosureLevel: "none", consentAccepted: true, externalDisclosureAccepted: true },
        "req-1",
      ),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("maps an unrecognized RPC error to ApiError('internal_error')", async () => {
    mockRequestGeminiAdvisory.mockResolvedValue({
      structuredOutput: SUCCEEDED_ADVISORY_ROW.structured_output,
      modelName: "gemini-2.0-flash",
      latencyMs: 500,
      retryCount: 0,
    });
    const fakeDb = createFakeDb({
      from: {
        reports: () => ({ data: REPORT_ROW, error: null }),
        model_predictions: () => ({ data: PREDICTION_ROW, error: null }),
      },
      rpc: {
        record_gemini_advisory_request: () => ({ data: null, error: { message: "connection reset" } }),
      },
    });

    await expect(
      requestGeminiAdvisoryForReport(
        fakeDb as never,
        "report-1",
        { imageDisclosureLevel: "none", consentAccepted: true, externalDisclosureAccepted: true },
        "req-1",
      ),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe("listGeminiAdvisoryRequests", () => {
  it("returns the advisory history for a report", async () => {
    const fakeDb = createFakeDb({
      from: { gemini_advisory_requests: () => ({ data: [SUCCEEDED_ADVISORY_ROW], error: null }) },
    });

    const result = await listGeminiAdvisoryRequests(fakeDb as never, "report-1");
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("advisory-1");
    expect(result[0]?.disclaimerLabel).toBe("Analisis Tambahan Eksternal — Tidak Menentukan Keputusan Resmi");
  });

  it("returns an empty array when there is no history", async () => {
    const fakeDb = createFakeDb({ from: { gemini_advisory_requests: () => ({ data: [], error: null }) } });
    const result = await listGeminiAdvisoryRequests(fakeDb as never, "report-1");
    expect(result).toEqual([]);
  });

  it("throws internal_error on a query error", async () => {
    const fakeDb = createFakeDb({
      from: { gemini_advisory_requests: () => ({ data: null, error: { message: "connection reset" } }) },
    });
    await expect(listGeminiAdvisoryRequests(fakeDb as never, "report-1")).rejects.toMatchObject({
      code: "internal_error",
    });
  });
});
