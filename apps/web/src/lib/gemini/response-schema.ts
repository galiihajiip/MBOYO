import { Type, type Schema } from "@google/genai";

/**
 * The exact JSON Schema (in @google/genai's Schema shape) Gemini is
 * constrained to produce via `responseSchema` — structured output only,
 * per this block's explicit requirement. This is the single source of
 * truth for the response shape; packages/domain/src/gemini-advisory.ts's
 * `geminiStructuredOutputSchema` (Zod) validates the parsed result against
 * the same field set as defense-in-depth (a model could technically ignore
 * responseSchema, so the Zod parse is not redundant).
 */
export const GEMINI_ADVISORY_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    evidenceSummary: {
      type: Type.STRING,
      description: "A neutral, factual summary of what is visible in the evidence (max ~1000 characters).",
    },
    suggestedFollowUpQuestion: {
      type: Type.STRING,
      nullable: true,
      description: "One optional question a Verifier could ask the Reporter for clarification, or null.",
    },
    nonBindingHypothesis: {
      type: Type.STRING,
      nullable: true,
      description:
        "A non-binding, non-authoritative hypothesis about the situation — never a probability, never a classification decision, or null.",
    },
    qualityObservations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Up to 5 short observations about image/evidence quality (lighting, angle, obstruction, etc.).",
    },
  },
  required: ["evidenceSummary", "suggestedFollowUpQuestion", "nonBindingHypothesis", "qualityObservations"],
};
