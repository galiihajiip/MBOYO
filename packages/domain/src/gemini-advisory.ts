import { z } from "zod";

/**
 * Shared Zod schemas for the Gemini verifier-advisory feature (BLOCK 22).
 * Per docs/adr/0004-local-ml-primary-gemini-advisory.md: Gemini is an
 * optional, external, non-authoritative advisory a Verifier may request
 * while reviewing a report — never a probability input, never a decision,
 * never automatically changing report.status. Structured output only
 * (never free-form chain-of-thought); the shape below is exactly what
 * apps/web/src/lib/gemini/client.ts requests from the model and exactly
 * what's persisted in gemini_advisory_requests.structured_output.
 */

export const GEMINI_IMAGE_DISCLOSURE_LEVELS = ["none", "redacted_image", "raw_image"] as const;
export type GeminiImageDisclosureLevel = (typeof GEMINI_IMAGE_DISCLOSURE_LEVELS)[number];

export const GEMINI_ADVISORY_STATUSES = ["succeeded", "failed", "timed_out", "rate_limited"] as const;
export type GeminiAdvisoryStatus = (typeof GEMINI_ADVISORY_STATUSES)[number];

// ============================================================================
// request command — POST /api/verifier/reports/[reportId]/gemini-advisory
// ============================================================================

export const requestGeminiAdvisorySchema = z.object({
  imageDisclosureLevel: z.enum(GEMINI_IMAGE_DISCLOSURE_LEVELS).default("none"),
  consentAccepted: z.literal(true, {
    message: "Persetujuan penggunaan analisis eksternal wajib disetujui.",
  }),
  externalDisclosureAccepted: z.literal(true, {
    message: "Pengungkapan bahwa data akan dikirim ke pihak eksternal wajib disetujui.",
  }),
});
export type RequestGeminiAdvisoryInput = z.infer<typeof requestGeminiAdvisorySchema>;

// ============================================================================
// structured output — the ONLY shape Gemini's response may take. Every
// field is bounded (max length / enum) so a malformed or injected response
// cannot smuggle arbitrarily large or unexpected content into storage or
// the Verifier UI.
// ============================================================================

export const geminiStructuredOutputSchema = z.object({
  evidenceSummary: z.string().max(1000),
  suggestedFollowUpQuestion: z.string().max(300).nullable(),
  /** A non-binding hypothesis about severity — explicitly NOT a probability
   * and NEVER treated as a classification; always rendered alongside the
   * required disclaimer, never in place of the local model's output. */
  nonBindingHypothesis: z.string().max(500).nullable(),
  qualityObservations: z.array(z.string().max(300)).max(5),
});
export type GeminiStructuredOutput = z.infer<typeof geminiStructuredOutputSchema>;

// ============================================================================
// response — the full record returned to the Verifier UI, mirroring
// gemini_advisory_requests' columns.
// ============================================================================

export const geminiAdvisoryResponseSchema = z.object({
  id: z.string().uuid(),
  reportId: z.string().uuid(),
  status: z.enum(GEMINI_ADVISORY_STATUSES),
  imageDisclosureLevel: z.enum(GEMINI_IMAGE_DISCLOSURE_LEVELS),
  structuredOutput: geminiStructuredOutputSchema.nullable(),
  errorMessage: z.string().nullable(),
  modelName: z.string(),
  latencyMs: z.number().int().min(0),
  retryCount: z.number().int().min(0),
  createdAt: z.string().datetime(),
  /** Verbatim required label — see docs/product/CONTENT_GUIDE.md. Always
   * present so the UI never has to hardcode/re-derive it. */
  disclaimerLabel: z.string(),
});
export type GeminiAdvisoryResponse = z.infer<typeof geminiAdvisoryResponseSchema>;

/** The exact, verbatim required UI label for every Gemini advisory
 * surface — see docs/product/CONTENT_GUIDE.md. A single exported
 * constant so no call site can accidentally paraphrase or typo it. */
export const GEMINI_ADVISORY_UI_LABEL =
  "Analisis Tambahan Eksternal — Tidak Menentukan Keputusan Resmi";
