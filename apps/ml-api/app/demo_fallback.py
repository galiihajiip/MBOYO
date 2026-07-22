"""Deterministic DEMO_MODE fallback — used ONLY when no active model has
loaded (app/model_registry.py's ModelRegistry.is_ready is False) AND
settings.demo_mode is True.

This broadens DEMO_MODE's previously UI-only scope (Reporter's
offline/reconnect toggle, per docs/architecture/SYSTEM_ARCHITECTURE.md) to
also cover this fallback — a user-approved decision recorded in this
block's docs/product/WORKING_CONTRACT.md entry, since AGENTS.md's ML
honesty rules already require any demo fallback to be visibly labeled via
"a DEMO_MODE flag," and this is that flag's serving-side counterpart.

CRITICAL — per AGENTS.md's ML honesty rules ("never fabricate or guarantee
metrics... label demo/synthetic fallbacks explicitly"): this fallback is
**deterministic**, not random, and every response it produces carries
`is_demo_fallback: true` plus a disclaimer stating the output is not a real
model prediction. It must never be presented as, or confusable with, a
genuine inference result. It is also structurally distinct from
`is_advisory_only` (BLOCK 20's release-gate mechanism) — a model that IS
loaded but failed its release gate returns `is_advisory_only: true` with
`is_demo_fallback: false`; this fallback only fires when there is no model
loaded at all.

Deterministic means: the same input image always yields the same output
(a hash of the image bytes selects the fallback class), rather than a
random pick — reproducibility matters for demo scripting and testing, and
"deterministic" is this block's own explicit requirement.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass

DEMO_FALLBACK_DISCLAIMER = (
    "DEMO_MODE fallback: no trained model is currently loaded, so this is a "
    "deterministic placeholder classification, not a real model prediction. "
    "It must never be used as evidence of actual damage severity."
)

_CLASSES: tuple[str, ...] = ("unknown", "no_damage", "minor_damage", "major_damage", "destroyed")


@dataclass(frozen=True)
class DemoFallbackResult:
    predicted_class: str
    probabilities: dict[str, float]
    confidence: float


def compute_demo_fallback(image_bytes: bytes) -> DemoFallbackResult:
    digest = hashlib.sha256(image_bytes).digest()
    class_index = digest[0] % len(_CLASSES)
    predicted_class = _CLASSES[class_index]

    # A skewed-but-fixed distribution (not a real softmax output) — high
    # enough on the selected class to be visibly "confident" in demo
    # screenshots, but the whole vector is a placeholder, never derived
    # from any actual image content beyond selecting which class to skew
    # toward.
    base_probability = 0.7
    remainder = (1.0 - base_probability) / (len(_CLASSES) - 1)
    probabilities = {
        class_name: base_probability if class_name == predicted_class else remainder
        for class_name in _CLASSES
    }

    return DemoFallbackResult(
        predicted_class=predicted_class,
        probabilities=probabilities,
        confidence=base_probability,
    )
