# ADR 0004 — Local ML Model as Primary Classifier, Gemini as Explicit Opt-In Advisory Only

## Status

Accepted

## Context

MBOYO's Verifier role depends on computer-vision output (damage-severity probabilities, quality signals) to assist — never replace — human classification decisions, per [AGENTS.md](../../AGENTS.md) ML honesty rules and the "human-in-the-loop verification" product pillar in [PRODUCT_CHARTER.md](../product/PRODUCT_CHARTER.md). A locally trained/hosted model (`apps/ml-api`, served via ONNX Runtime per [SUCCESS_METRICS.md](../product/SUCCESS_METRICS.md) CPU p95 latency metric) is one option; a hosted multimodal LLM such as Gemini is another, and could plausibly also produce damage assessments or narrative explanations.

## Decision

The locally trained/hosted CV model is the **primary and only** source of the probabilities and quality/duplicate/location-confidence signals the Verifier relies on for classification decisions. Gemini, if enabled at all, is an **explicit opt-in, external, advisory-only** feature: it may provide supplementary narrative context to a Verifier, but its output is never used as a probability input, is never authoritative, never blocks or auto-fills a Verifier decision, and is disabled by default.

## Consequences

- Model evaluation, the release gate (macro-F1, destroyed recall, calibration error, per [SUCCESS_METRICS.md](../product/SUCCESS_METRICS.md)), and the advisory-only fallback for gate failures all apply exclusively to the local model — there is no equivalent evaluation obligation for Gemini's advisory text because it never makes a classification claim in the first place.
- No user data (evidence photos, report metadata) leaves the system boundary to a third party unless Gemini is explicitly enabled, and even then only from `apps/web` server-side, never from `apps/ml-api` or `apps/worker`, minimizing the data-exposure surface described in [RISK_REGISTER.md](../product/RISK_REGISTER.md) risk #9 and [THREAT_MODEL.md](../security/THREAT_MODEL.md) threats #8–9.
- The Verifier UI must render Gemini's output in a visually distinct, clearly labeled "advisory" panel (Bahasa Indonesia) so it can never be mistaken for the model's own probability output — this is a design requirement carried into future block implementation, not just a policy statement.
- Because Gemini is additive and non-authoritative, it can be disabled instantly (its feature flag) without affecting the correctness or availability of the core Verifier workflow — satisfying the resilience goal in [PRODUCTION_SCOPE.md](../product/PRODUCTION_SCOPE.md) that "Gemini's unavailability must never block the Verifier decision path."
- This decision is explicitly out of MVP scope (per [MVP_SCOPE.md](../product/MVP_SCOPE.md)) — Gemini integration, when built, is a Production-tier addition, giving time to design the data-handling review mentioned in [RISK_REGISTER.md](../product/RISK_REGISTER.md) risk #9 before any real evidence could be sent externally.

## Alternatives Considered

- **Gemini (or another hosted LLM) as the primary/sole classifier:** rejected — would make the core classification signal dependent on an external, non-evaluable-by-our-own-release-gate service, undermining the ML honesty rules in [AGENTS.md](../../AGENTS.md) (no local, measured, dated evaluation would exist for it) and introducing an unavoidable external dependency into the Verifier's critical path.
- **No Gemini integration at all, ever:** considered but not adopted as a final decision — advisory narrative context has plausible value for Verifiers reviewing ambiguous evidence; the "explicit opt-in, advisory-only" framing preserves that option while fully containing its risk.
