"""Confidence/entropy/quality-based abstention decision for apps/ml-api.

Deliberately mirrors ml/src/training/abstention.py's low-confidence/
high-entropy/quality-failure signals (BLOCK 20) — but is a separate,
self-contained implementation, since apps/ml-api never imports ml/ directly
(AGENTS.md architecture boundary: ml/ is the training/evaluation project,
apps/ml-api is the serving project). Out-of-distribution detection is not
reimplemented here — BLOCK 20's feature-centroid OOD proxy was never wired
into a servable form (disclosed as a known limitation there), so this
service's abstention only covers three of the four BLOCK 20 signals; this
is a known, disclosed gap, not a silent omission.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

DEFAULT_CONFIDENCE_THRESHOLD = 0.5
MAX_ENTROPY_NATS = 1.5
MIN_QUALITY_SCORE = 0.3


@dataclass(frozen=True)
class AbstentionDecision:
    abstained: bool
    reasons: tuple[str, ...]


def compute_entropy(probabilities: np.ndarray) -> float:
    epsilon = 1e-12
    clipped = np.clip(probabilities, epsilon, 1.0)
    return float(-np.sum(clipped * np.log(clipped)))


def decide_abstention(
    probabilities: np.ndarray,
    quality_score: float,
    confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
    max_entropy_nats: float = MAX_ENTROPY_NATS,
    min_quality_score: float = MIN_QUALITY_SCORE,
) -> AbstentionDecision:
    reasons: list[str] = []

    confidence = float(np.max(probabilities))
    if confidence < confidence_threshold:
        reasons.append(
            f"low_confidence: {confidence:.3f} below threshold {confidence_threshold:.3f}"
        )

    entropy = compute_entropy(probabilities)
    if entropy > max_entropy_nats:
        reasons.append(f"high_entropy: {entropy:.3f} nats exceeds {max_entropy_nats:.3f}")

    if quality_score < min_quality_score:
        reasons.append(f"quality_gate_failure: {quality_score:.3f} below {min_quality_score:.3f}")

    return AbstentionDecision(abstained=len(reasons) > 0, reasons=tuple(reasons))
