"""The abstain / needs_manual_review decision — the ML-side logic behind
docs/product/STATE_MACHINES.md's already-designed
`analysis_running --> needs_manual_review` transition ("inference fails /
advisory-only / low confidence") and
`analysis_completed --> needs_manual_review` transition ("quality/duplicate
signal flags it"). This module does not invent that state; it decides when
an individual prediction should land there.

Per AGENTS.md's ML honesty rules ("model outputs are probabilistic signals
for human verifiers, not final determinations"), abstaining never means
"reject the report" — it means "do not offer a confident classification;
route to full manual review instead." A model that never abstains despite
being wrong just as often as one that abstains appropriately is the worse
outcome this module exists to avoid.

Four independent signals, ANY of which triggers abstention (never averaged
against each other — a high-confidence-but-out-of-distribution input must
still abstain, regardless of how confident the softmax looks):
  1. Low top-1 confidence (below the per-class threshold from calibration.py,
     or the global default if no per-class threshold applies).
  2. High predictive entropy (a flat, non-committal probability
     distribution even when top-1 happens to clear the confidence bar).
  3. Out-of-distribution signal (input's feature-space distance from the
     training distribution is unusually large — a cheap, explainable
     proxy, not a claim of certainty; see AbstentionConfig.ood docstring).
  4. Quality-gate failure (a quality_score below a floor — mirrors
     RISK_REGISTER.md risk #4's "quality signal computed and surfaced
     explicitly to the Verifier... low-quality inputs should trigger the
     abstention path").
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np


@dataclass(frozen=True)
class AbstentionThresholds:
    max_entropy_nats: float
    quality_score_min: float
    ood_distance_max: float | None
    default_confidence_threshold: float


@dataclass(frozen=True)
class AbstentionDecision:
    should_abstain: bool
    reasons: tuple[str, ...] = field(default_factory=tuple)


def compute_predictive_entropy(class_probabilities: np.ndarray) -> float:
    """Shannon entropy (nats) of a single sample's softmax distribution — 0
    for a fully confident one-hot-like prediction, ln(num_classes) for a
    uniform (maximally uncertain) one. Computed with a small epsilon to
    avoid log(0) for a probability that rounds exactly to zero."""
    epsilon = 1e-12
    probabilities = np.clip(class_probabilities, epsilon, 1.0)
    return float(-np.sum(probabilities * np.log(probabilities)))


def decide_abstention(
    class_probabilities: np.ndarray,
    classes: tuple[str, ...],
    thresholds: AbstentionThresholds,
    quality_score: float,
    per_class_confidence_threshold: float | None = None,
    ood_distance: float | None = None,
) -> AbstentionDecision:
    """Evaluates all four signals for one prediction and returns the
    combined decision plus which specific signal(s) fired — the reasons are
    surfaced to the Verifier (never hidden), since "why did the model
    abstain" is itself useful review context, not an internal implementation
    detail."""
    if class_probabilities.shape[0] != len(classes):
        raise ValueError(
            f"class_probabilities has {class_probabilities.shape[0]} entries, "
            f"expected {len(classes)} to match `classes`"
        )

    reasons: list[str] = []

    top_confidence = float(np.max(class_probabilities))
    confidence_threshold = (
        per_class_confidence_threshold
        if per_class_confidence_threshold is not None
        else thresholds.default_confidence_threshold
    )
    if top_confidence < confidence_threshold:
        reasons.append(
            f"low_confidence: top confidence {top_confidence:.3f} below threshold "
            f"{confidence_threshold:.3f}"
        )

    entropy = compute_predictive_entropy(class_probabilities)
    if entropy > thresholds.max_entropy_nats:
        reasons.append(
            f"high_entropy: predictive entropy {entropy:.3f} nats exceeds "
            f"{thresholds.max_entropy_nats:.3f}"
        )

    if quality_score < thresholds.quality_score_min:
        reasons.append(
            f"quality_gate_failure: quality_score {quality_score:.3f} below "
            f"{thresholds.quality_score_min:.3f}"
        )

    if (
        ood_distance is not None
        and thresholds.ood_distance_max is not None
        and ood_distance > thresholds.ood_distance_max
    ):
        reasons.append(
            f"out_of_distribution: distance {ood_distance:.3f} exceeds "
            f"{thresholds.ood_distance_max:.3f}"
        )

    return AbstentionDecision(should_abstain=len(reasons) > 0, reasons=tuple(reasons))


@dataclass(frozen=True)
class FeatureCentroidOodDetector:
    """A deliberately simple, explainable out-of-distribution proxy: the
    Euclidean distance from a sample's penultimate-layer feature vector to
    its predicted class's training-set feature centroid. This is NOT a
    state-of-the-art OOD method (e.g. no Mahalanobis whitening, no
    density estimation) — it is chosen specifically because "distance from
    this class's typical training examples" is a distance a Verifier can be
    told about honestly, unlike an opaque learned OOD score. Per AGENTS.md's
    ML honesty rules, this must never be described as a certainty measure —
    only as a proxy signal that contributes to the abstain decision above.
    """

    class_centroids: dict[str, np.ndarray]

    def distance_to_predicted_class_centroid(
        self, feature_vector: np.ndarray, predicted_class: str
    ) -> float | None:
        centroid = self.class_centroids.get(predicted_class)
        if centroid is None:
            return None
        return float(np.linalg.norm(feature_vector - centroid))


def fit_feature_centroids(
    feature_vectors: np.ndarray, labels: np.ndarray, classes: tuple[str, ...]
) -> FeatureCentroidOodDetector:
    """Fits one centroid per class from training-split feature vectors
    (mean feature vector among that class's training examples) — must be
    fit on the training split only, since the resulting centroids are later
    used as a reference distribution the test-set OOD check compares
    against; fitting on the test split itself would make "distance from
    training distribution" meaningless."""
    if feature_vectors.shape[0] == 0:
        raise ValueError("Cannot fit feature centroids on zero samples")

    centroids: dict[str, np.ndarray] = {}
    for class_index, class_name in enumerate(classes):
        mask = labels == class_index
        if np.sum(mask) > 0:
            centroids[class_name] = np.mean(feature_vectors[mask], axis=0)

    return FeatureCentroidOodDetector(class_centroids=centroids)
