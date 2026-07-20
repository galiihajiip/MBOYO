import "server-only";
import { GoogleGenAI } from "@google/genai";
import { geminiStructuredOutputSchema, type GeminiStructuredOutput } from "@mboyo/domain";
import { buildSystemInstruction, buildUntrustedContentBlock } from "./prompt";
import { GEMINI_ADVISORY_RESPONSE_SCHEMA } from "./response-schema";
import { SlidingWindowRateLimiter } from "./rate-limit";

/**
 * The Gemini advisory client — the ONLY place apps/web calls the Gemini
 * API from (per docs/adr/0004-local-ml-primary-gemini-advisory.md: never
 * from apps/ml-api/apps/worker). GEMINI_API_KEY is read via
 * lib/env.server.ts's getServerEnv(), which is `server-only`-guarded —
 * this module itself is also marked `server-only` as defense in depth, so
 * even an accidental client-side import fails at build time rather than
 * silently bundling the key.
 */

export class GeminiNotConfiguredError extends Error {
  constructor() {
    super("GEMINI_API_KEY is not configured — the Gemini advisory feature is unavailable.");
    this.name = "GeminiNotConfiguredError";
  }
}

export class GeminiTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Gemini call did not complete within ${timeoutMs}ms.`);
    this.name = "GeminiTimeoutError";
  }
}

export class GeminiRateLimitedError extends Error {
  constructor() {
    super("Gemini advisory rate limit exceeded — try again shortly.");
    this.name = "GeminiRateLimitedError";
  }
}

export class GeminiInvalidResponseError extends Error {
  constructor(cause: unknown) {
    super("Gemini returned a response that did not match the required structured output shape.");
    this.name = "GeminiInvalidResponseError";
    this.cause = cause;
  }
}

export interface GeminiAdvisoryCallInput {
  /** Reporter-supplied free text — always treated as untrusted data, never
   * concatenated into the system instruction (see ./prompt.ts). */
  reportDescription: string;
  /** Derived, non-visual signals — always included regardless of image
   * disclosure level, since these never require sending any image data. */
  localModelSummary: {
    prediction: string;
    confidence: number;
    qualityScore: number;
  };
  /** Present only when imageDisclosureLevel is 'redacted_image' or
   * 'raw_image' — base64-encoded, already redacted by the caller if the
   * level is 'redacted_image' (this module never decides redaction
   * itself; see lib/reports/service/gemini-advisory.ts). */
  imageBase64: string | null;
  imageMimeType: string | null;
}

export interface GeminiAdvisoryCallResult {
  structuredOutput: GeminiStructuredOutput;
  modelName: string;
  latencyMs: number;
  retryCount: number;
}

export interface GeminiClientConfig {
  apiKey: string | undefined;
  model: string;
  timeoutMs: number;
  maxRetries: number;
  rateLimitPerMinute: number;
}

const rateLimiters = new Map<string, SlidingWindowRateLimiter>();

function getRateLimiter(rateLimitPerMinute: number): SlidingWindowRateLimiter {
  const key = String(rateLimitPerMinute);
  let limiter = rateLimiters.get(key);
  if (!limiter) {
    limiter = new SlidingWindowRateLimiter(rateLimitPerMinute);
    rateLimiters.set(key, limiter);
  }
  return limiter;
}

function isRetryableStatus(status: number | undefined): boolean {
  // 429 (provider-side rate limit) and 5xx are transient; everything else
  // (400/401/403/etc.) is a caller/config error retrying won't fix.
  return status === 429 || (status !== undefined && status >= 500);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => reject(new GeminiTimeoutError(timeoutMs)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutHandle!);
  }
}

/**
 * Calls Gemini once, with the fixed system instruction + untrusted-data
 * block + structured-output schema, applying a per-process rate limit,
 * a hard timeout, and bounded retries on transient failures only.
 * Never logs or persists the raw prompt/response beyond what the caller
 * chooses to store (see the service layer) — this function itself holds
 * nothing in memory beyond the single call's lifetime.
 */
export async function requestGeminiAdvisory(
  input: GeminiAdvisoryCallInput,
  config: GeminiClientConfig,
  rateLimitKey: string,
): Promise<GeminiAdvisoryCallResult> {
  if (!config.apiKey) {
    throw new GeminiNotConfiguredError();
  }

  const limiter = getRateLimiter(config.rateLimitPerMinute);
  if (!limiter.allow(rateLimitKey)) {
    throw new GeminiRateLimitedError();
  }

  const client = new GoogleGenAI({ apiKey: config.apiKey });

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    {
      text: [
        buildUntrustedContentBlock(input.reportDescription),
        "",
        "Local model summary (already computed, not from Gemini):",
        `- Predicted severity: ${input.localModelSummary.prediction}`,
        `- Confidence: ${input.localModelSummary.confidence.toFixed(3)}`,
        `- Image quality score: ${input.localModelSummary.qualityScore.toFixed(3)}`,
      ].join("\n"),
    },
  ];

  if (input.imageBase64 && input.imageMimeType) {
    parts.push({ inlineData: { mimeType: input.imageMimeType, data: input.imageBase64 } });
  }

  const startedAt = Date.now();
  let retryCount = 0;
  let lastError: unknown;

  while (retryCount <= config.maxRetries) {
    try {
      const response = await withTimeout(
        client.models.generateContent({
          model: config.model,
          contents: [{ role: "user", parts }],
          config: {
            systemInstruction: buildSystemInstruction(),
            responseMimeType: "application/json",
            responseSchema: GEMINI_ADVISORY_RESPONSE_SCHEMA,
          },
        }),
        config.timeoutMs,
      );

      const rawText = response.text;
      if (!rawText) {
        throw new GeminiInvalidResponseError("empty response text");
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawText);
      } catch (parseError) {
        throw new GeminiInvalidResponseError(parseError);
      }

      const validated = geminiStructuredOutputSchema.safeParse(parsedJson);
      if (!validated.success) {
        throw new GeminiInvalidResponseError(validated.error);
      }

      return {
        structuredOutput: validated.data,
        modelName: config.model,
        latencyMs: Date.now() - startedAt,
        retryCount,
      };
    } catch (error) {
      lastError = error;

      if (error instanceof GeminiTimeoutError || error instanceof GeminiInvalidResponseError) {
        throw error;
      }

      const status = extractStatusCode(error);
      if (!isRetryableStatus(status) || retryCount >= config.maxRetries) {
        throw error;
      }

      retryCount += 1;
      await sleep(2 ** retryCount * 250);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Gemini advisory call failed");
}

function extractStatusCode(error: unknown): number | undefined {
  if (error && typeof error === "object" && "status" in error) {
    const status = error.status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
