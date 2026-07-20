import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface MockGenerateContentArgs {
  model: string;
  contents: Array<{ role: string; parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> }>;
  config: { systemInstruction: string; responseMimeType: string; responseSchema: unknown };
}

const generateContentMock = vi.fn<(args: MockGenerateContentArgs) => Promise<{ text: string | undefined }>>();

vi.mock("@google/genai", () => {
  class MockGoogleGenAI {
    models = { generateContent: generateContentMock };
  }
  return {
    GoogleGenAI: MockGoogleGenAI,
    Type: { OBJECT: "OBJECT", STRING: "STRING", ARRAY: "ARRAY" },
  };
});

import {
  GeminiInvalidResponseError,
  GeminiNotConfiguredError,
  GeminiRateLimitedError,
  GeminiTimeoutError,
  requestGeminiAdvisory,
  type GeminiClientConfig,
} from "./client";

const BASE_CONFIG: GeminiClientConfig = {
  apiKey: "test-key",
  model: "gemini-2.0-flash",
  timeoutMs: 500,
  maxRetries: 1,
  rateLimitPerMinute: 100,
};

const VALID_STRUCTURED_OUTPUT = {
  evidenceSummary: "A damaged roof is visible.",
  suggestedFollowUpQuestion: "When did the damage occur?",
  nonBindingHypothesis: "Possible wind damage.",
  qualityObservations: ["Slightly blurry"],
};

function mockSuccessResponse(output: unknown = VALID_STRUCTURED_OUTPUT) {
  generateContentMock.mockResolvedValueOnce({ text: JSON.stringify(output) });
}

beforeEach(() => {
  generateContentMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("requestGeminiAdvisory — happy path (mocked provider, no real API call)", () => {
  it("returns validated structured output on success", async () => {
    mockSuccessResponse();

    const result = await requestGeminiAdvisory(
      {
        reportDescription: "Rumah roboh sebagian.",
        localModelSummary: { prediction: "major_damage", confidence: 0.8, qualityScore: 0.9 },
        imageBase64: null,
        imageMimeType: null,
      },
      BASE_CONFIG,
      "verifier-1",
    );

    expect(result.structuredOutput).toEqual(VALID_STRUCTURED_OUTPUT);
    expect(result.modelName).toBe("gemini-2.0-flash");
    expect(result.retryCount).toBe(0);
    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });

  it("never sends image data when imageBase64 is null", async () => {
    mockSuccessResponse();

    await requestGeminiAdvisory(
      {
        reportDescription: "test",
        localModelSummary: { prediction: "unknown", confidence: 0.5, qualityScore: 0.5 },
        imageBase64: null,
        imageMimeType: null,
      },
      BASE_CONFIG,
      "verifier-1",
    );

    const callArgs = generateContentMock.mock.calls[0]![0];
    const parts = callArgs.contents[0]!.parts;
    expect(parts).toHaveLength(1);
    expect(parts[0]).not.toHaveProperty("inlineData");
  });

  it("includes image data as inlineData when provided", async () => {
    mockSuccessResponse();

    await requestGeminiAdvisory(
      {
        reportDescription: "test",
        localModelSummary: { prediction: "unknown", confidence: 0.5, qualityScore: 0.5 },
        imageBase64: "ZmFrZWJhc2U2NA==",
        imageMimeType: "image/jpeg",
      },
      BASE_CONFIG,
      "verifier-1",
    );

    const callArgs = generateContentMock.mock.calls[0]![0];
    const parts = callArgs.contents[0]!.parts;
    expect(parts).toHaveLength(2);
    expect(parts[1]).toEqual({ inlineData: { mimeType: "image/jpeg", data: "ZmFrZWJhc2U2NA==" } });
  });

  it("always sends a fixed systemInstruction and JSON responseSchema config", async () => {
    mockSuccessResponse();

    await requestGeminiAdvisory(
      {
        reportDescription: "test",
        localModelSummary: { prediction: "unknown", confidence: 0.5, qualityScore: 0.5 },
        imageBase64: null,
        imageMimeType: null,
      },
      BASE_CONFIG,
      "verifier-1",
    );

    const callArgs = generateContentMock.mock.calls[0]![0];
    expect(callArgs.config.systemInstruction).toEqual(expect.any(String));
    expect(callArgs.config.responseMimeType).toBe("application/json");
    expect(callArgs.config.responseSchema).toBeDefined();
  });
});

describe("requestGeminiAdvisory — configuration and validation failures", () => {
  it("throws GeminiNotConfiguredError when apiKey is absent", async () => {
    await expect(
      requestGeminiAdvisory(
        {
          reportDescription: "test",
          localModelSummary: { prediction: "unknown", confidence: 0.5, qualityScore: 0.5 },
          imageBase64: null,
          imageMimeType: null,
        },
        { ...BASE_CONFIG, apiKey: undefined },
        "verifier-1",
      ),
    ).rejects.toBeInstanceOf(GeminiNotConfiguredError);

    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it("throws GeminiInvalidResponseError when the response is not valid JSON", async () => {
    generateContentMock.mockResolvedValueOnce({ text: "not valid json" });

    await expect(
      requestGeminiAdvisory(
        {
          reportDescription: "test",
          localModelSummary: { prediction: "unknown", confidence: 0.5, qualityScore: 0.5 },
          imageBase64: null,
          imageMimeType: null,
        },
        BASE_CONFIG,
        "verifier-1",
      ),
    ).rejects.toBeInstanceOf(GeminiInvalidResponseError);
  });

  it("throws GeminiInvalidResponseError when JSON does not match the structured output schema", async () => {
    mockSuccessResponse({ unexpectedField: "chain of thought reasoning leaked here" });

    await expect(
      requestGeminiAdvisory(
        {
          reportDescription: "test",
          localModelSummary: { prediction: "unknown", confidence: 0.5, qualityScore: 0.5 },
          imageBase64: null,
          imageMimeType: null,
        },
        BASE_CONFIG,
        "verifier-1",
      ),
    ).rejects.toBeInstanceOf(GeminiInvalidResponseError);
  });

  it("throws GeminiInvalidResponseError (not retried) when response text is empty", async () => {
    generateContentMock.mockResolvedValueOnce({ text: undefined });

    await expect(
      requestGeminiAdvisory(
        {
          reportDescription: "test",
          localModelSummary: { prediction: "unknown", confidence: 0.5, qualityScore: 0.5 },
          imageBase64: null,
          imageMimeType: null,
        },
        BASE_CONFIG,
        "verifier-1",
      ),
    ).rejects.toBeInstanceOf(GeminiInvalidResponseError);

    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });
});

describe("requestGeminiAdvisory — rate limiting", () => {
  it("throws GeminiRateLimitedError once the per-key limit is exceeded", async () => {
    mockSuccessResponse();
    const tightConfig: GeminiClientConfig = { ...BASE_CONFIG, rateLimitPerMinute: 1 };

    await requestGeminiAdvisory(
      {
        reportDescription: "test",
        localModelSummary: { prediction: "unknown", confidence: 0.5, qualityScore: 0.5 },
        imageBase64: null,
        imageMimeType: null,
      },
      tightConfig,
      "verifier-rate-limit-test",
    );

    await expect(
      requestGeminiAdvisory(
        {
          reportDescription: "test",
          localModelSummary: { prediction: "unknown", confidence: 0.5, qualityScore: 0.5 },
          imageBase64: null,
          imageMimeType: null,
        },
        tightConfig,
        "verifier-rate-limit-test",
      ),
    ).rejects.toBeInstanceOf(GeminiRateLimitedError);
  });
});

describe("requestGeminiAdvisory — retry behavior on transient failures", () => {
  it("retries on a 503-style transient error and eventually succeeds", async () => {
    const transientError = Object.assign(new Error("Service Unavailable"), { status: 503 });
    generateContentMock.mockRejectedValueOnce(transientError);
    mockSuccessResponse();

    const result = await requestGeminiAdvisory(
      {
        reportDescription: "test",
        localModelSummary: { prediction: "unknown", confidence: 0.5, qualityScore: 0.5 },
        imageBase64: null,
        imageMimeType: null,
      },
      { ...BASE_CONFIG, maxRetries: 2 },
      "verifier-retry-test-1",
    );

    expect(result.retryCount).toBe(1);
    expect(generateContentMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 400-style permanent error", async () => {
    const permanentError = Object.assign(new Error("Bad Request"), { status: 400 });
    generateContentMock.mockRejectedValueOnce(permanentError);

    await expect(
      requestGeminiAdvisory(
        {
          reportDescription: "test",
          localModelSummary: { prediction: "unknown", confidence: 0.5, qualityScore: 0.5 },
          imageBase64: null,
          imageMimeType: null,
        },
        { ...BASE_CONFIG, maxRetries: 2 },
        "verifier-retry-test-2",
      ),
    ).rejects.toThrow("Bad Request");

    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after exhausting maxRetries on a persistently transient error", async () => {
    const transientError = Object.assign(new Error("Service Unavailable"), { status: 503 });
    generateContentMock.mockRejectedValue(transientError);

    await expect(
      requestGeminiAdvisory(
        {
          reportDescription: "test",
          localModelSummary: { prediction: "unknown", confidence: 0.5, qualityScore: 0.5 },
          imageBase64: null,
          imageMimeType: null,
        },
        { ...BASE_CONFIG, maxRetries: 2 },
        "verifier-retry-test-3",
      ),
    ).rejects.toThrow("Service Unavailable");

    expect(generateContentMock).toHaveBeenCalledTimes(3);
  });
});

describe("requestGeminiAdvisory — timeout", () => {
  it("throws GeminiTimeoutError when the call exceeds timeoutMs", async () => {
    generateContentMock.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve({ text: "{}" }), 5000)),
    );

    await expect(
      requestGeminiAdvisory(
        {
          reportDescription: "test",
          localModelSummary: { prediction: "unknown", confidence: 0.5, qualityScore: 0.5 },
          imageBase64: null,
          imageMimeType: null,
        },
        { ...BASE_CONFIG, timeoutMs: 50 },
        "verifier-timeout-test",
      ),
    ).rejects.toBeInstanceOf(GeminiTimeoutError);
  });
});
