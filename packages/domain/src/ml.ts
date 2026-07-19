import { z } from "zod";
import { SEVERITY_CLASSES } from "./enums";

/**
 * Shared Zod schemas for apps/ml-api's inference contract (BLOCK 21) —
 * mirrored field-for-field in apps/ml-api/app/schemas.py (Python/Pydantic),
 * matching the health.ts/schemas.py cross-language mirroring precedent from
 * an earlier block. Both apps/web (via packages/api-client) and apps/worker
 * (Python, mirrors this shape independently) must stay in lockstep with
 * this file.
 *
 * severityProbabilitiesSchema deliberately matches
 * model_predictions.severity_probabilities's exact check constraint
 * (supabase/migrations/20260716153709_core_schema.sql): all 5
 * SEVERITY_CLASSES keys present, each in [0, 1], summing to ~1 — rejecting
 * a malformed/fabricated probability vector at the schema layer too, not
 * only at the database layer, per AGENTS.md's ML honesty rules.
 */

export const severityProbabilitiesSchema = z
  .object({
    unknown: z.number().min(0).max(1),
    no_damage: z.number().min(0).max(1),
    minor_damage: z.number().min(0).max(1),
    major_damage: z.number().min(0).max(1),
    destroyed: z.number().min(0).max(1),
  })
  .refine(
    (probabilities) => {
      const sum = SEVERITY_CLASSES.reduce((total, key) => total + probabilities[key], 0);
      return Math.abs(sum - 1) < 0.01;
    },
    { message: "severity probabilities must sum to ~1" },
  );
export type SeverityProbabilities = z.infer<typeof severityProbabilitiesSchema>;

// ============================================================================
// POST /validate-image — a lightweight pre-check apps/worker (or apps/web,
// at upload time) can call before committing to the heavier /predict call;
// never itself writes anything.
// ============================================================================

export const validateImageRequestSchema = z.object({
  imageBase64: z.string().min(1),
  mimeType: z.string().min(1),
});
export type ValidateImageRequest = z.infer<typeof validateImageRequestSchema>;

export const validateImageResponseSchema = z.object({
  valid: z.boolean(),
  qualityScore: z.number().min(0).max(1),
  reasons: z.array(z.string()),
  requestId: z.string(),
});
export type ValidateImageResponse = z.infer<typeof validateImageResponseSchema>;

// ============================================================================
// POST /predict — the core inference call.
// ============================================================================

export const predictRequestSchema = z.object({
  reportId: z.string().uuid(),
  imageBase64: z.string().min(1),
  mimeType: z.string().min(1),
});
export type PredictRequest = z.infer<typeof predictRequestSchema>;

export const modelInfoSchema = z.object({
  version: z.string(),
  architecture: z.string(),
  checksum: z.string(),
  preprocessingVersion: z.string(),
  isAdvisoryOnly: z.boolean(),
});
export type ModelInfo = z.infer<typeof modelInfoSchema>;

export const qualityChecksSchema = z.object({
  qualityScore: z.number().min(0).max(1),
  passed: z.boolean(),
  reasons: z.array(z.string()),
});
export type QualityChecks = z.infer<typeof qualityChecksSchema>;

/**
 * predictedClass/confidence/entropy/abstained mirror
 * ml/src/training/abstention.py's decision shape exactly (BLOCK 20) — this
 * is the same abstention logic, invoked at serving time instead of
 * evaluation time.
 */
export const predictResponseSchema = z.object({
  prediction: z.enum(SEVERITY_CLASSES),
  calibratedProbabilities: severityProbabilitiesSchema,
  confidence: z.number().min(0).max(1),
  entropy: z.number().min(0),
  abstained: z.boolean(),
  abstentionReasons: z.array(z.string()),
  qualityChecks: qualityChecksSchema,
  model: modelInfoSchema,
  latencyMs: z.number().min(0),
  explanationRef: z.string().nullable(),
  disclaimer: z.string(),
  isDemoFallback: z.boolean(),
  requestId: z.string(),
});
export type PredictResponse = z.infer<typeof predictResponseSchema>;

// ============================================================================
// POST /explain — Grad-CAM explanation for a prediction already made.
// ============================================================================

export const explainRequestSchema = z.object({
  reportId: z.string().uuid(),
  imageBase64: z.string().min(1),
  mimeType: z.string().min(1),
  targetClass: z.enum(SEVERITY_CLASSES).optional(),
});
export type ExplainRequest = z.infer<typeof explainRequestSchema>;

export const explainResponseSchema = z.object({
  heatmapPngBase64: z.string(),
  targetClass: z.enum(SEVERITY_CLASSES),
  disclaimer: z.string(),
  model: modelInfoSchema,
  latencyMs: z.number().min(0),
  requestId: z.string(),
});
export type ExplainResponse = z.infer<typeof explainResponseSchema>;

// ============================================================================
// POST /batch-predict — internal only (apps/worker use); same per-item
// shape as /predict, batched.
// ============================================================================

export const batchPredictRequestSchema = z.object({
  items: z.array(predictRequestSchema).min(1).max(16),
});
export type BatchPredictRequest = z.infer<typeof batchPredictRequestSchema>;

export const batchPredictResponseSchema = z.object({
  results: z.array(
    z.discriminatedUnion("ok", [
      z.object({ ok: z.literal(true), reportId: z.string().uuid(), result: predictResponseSchema }),
      z.object({ ok: z.literal(false), reportId: z.string().uuid(), error: z.string() }),
    ]),
  ),
  requestId: z.string(),
});
export type BatchPredictResponse = z.infer<typeof batchPredictResponseSchema>;

// ============================================================================
// GET /model-info — the currently loaded model's identity/release status.
// ============================================================================

export const modelInfoResponseSchema = z.object({
  model: modelInfoSchema,
  loadedAt: z.string().datetime(),
  requestId: z.string(),
});
export type ModelInfoResponse = z.infer<typeof modelInfoResponseSchema>;

// ============================================================================
// GET /ready
// ============================================================================

export const readyResponseSchema = z.object({
  ready: z.boolean(),
  reason: z.string().nullable(),
  requestId: z.string(),
});
export type ReadyResponse = z.infer<typeof readyResponseSchema>;

// ============================================================================
// Structured error envelope — every 4xx/5xx from apps/ml-api uses this
// shape, mirroring apps/web's { ok: false, error, requestId } convention
// (apps/web/src/lib/api/result.ts) so both languages' error bodies are
// shaped the same way even though they're produced by different frameworks.
// ============================================================================

export const mlApiErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
  requestId: z.string(),
});
export type MlApiErrorResponse = z.infer<typeof mlApiErrorResponseSchema>;
