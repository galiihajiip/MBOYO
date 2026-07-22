from __future__ import annotations

import numpy as np
import pytest

from training.abstention import (
    AbstentionThresholds,
    compute_predictive_entropy,
    decide_abstention,
    fit_feature_centroids,
)

CLASSES = ("no_damage", "minor_damage", "major_damage", "destroyed", "unknown")


def _thresholds(**overrides: float | None) -> AbstentionThresholds:
    defaults: dict[str, float | None] = {
        "max_entropy_nats": 1.5,
        "quality_score_min": 0.3,
        "ood_distance_max": None,
        "default_confidence_threshold": 0.5,
    }
    defaults.update(overrides)
    return AbstentionThresholds(**defaults)  # type: ignore[arg-type]


def test_predictive_entropy_is_zero_for_one_hot() -> None:
    probabilities = np.array([1.0, 0.0, 0.0, 0.0, 0.0])
    assert compute_predictive_entropy(probabilities) == pytest.approx(0.0, abs=1e-6)


def test_predictive_entropy_is_maximal_for_uniform_distribution() -> None:
    probabilities = np.full(5, 0.2)
    entropy = compute_predictive_entropy(probabilities)
    assert entropy == pytest.approx(np.log(5), abs=1e-6)


def test_decide_abstention_confident_high_quality_prediction_does_not_abstain() -> None:
    probabilities = np.array([0.95, 0.0125, 0.0125, 0.0125, 0.0125])
    decision = decide_abstention(probabilities, CLASSES, _thresholds(), quality_score=0.9)
    assert decision.should_abstain is False
    assert decision.reasons == ()


def test_decide_abstention_low_confidence_triggers_abstain() -> None:
    probabilities = np.array([0.3, 0.25, 0.2, 0.15, 0.1])
    decision = decide_abstention(probabilities, CLASSES, _thresholds(), quality_score=0.9)
    assert decision.should_abstain is True
    assert any("low_confidence" in reason for reason in decision.reasons)


def test_decide_abstention_high_entropy_triggers_abstain_even_if_confident_enough() -> None:
    # Top confidence clears the 0.5 bar, but the rest is spread out enough
    # to push entropy above the configured ceiling.
    probabilities = np.array([0.55, 0.2, 0.15, 0.06, 0.04])
    thresholds = _thresholds(max_entropy_nats=0.5)
    decision = decide_abstention(probabilities, CLASSES, thresholds, quality_score=0.9)
    assert decision.should_abstain is True
    assert any("high_entropy" in reason for reason in decision.reasons)


def test_decide_abstention_low_quality_triggers_abstain() -> None:
    probabilities = np.array([0.95, 0.0125, 0.0125, 0.0125, 0.0125])
    decision = decide_abstention(probabilities, CLASSES, _thresholds(), quality_score=0.1)
    assert decision.should_abstain is True
    assert any("quality_gate_failure" in reason for reason in decision.reasons)


def test_decide_abstention_ood_distance_triggers_abstain_when_configured() -> None:
    probabilities = np.array([0.95, 0.0125, 0.0125, 0.0125, 0.0125])
    thresholds = _thresholds(ood_distance_max=1.0)
    decision = decide_abstention(
        probabilities, CLASSES, thresholds, quality_score=0.9, ood_distance=5.0
    )
    assert decision.should_abstain is True
    assert any("out_of_distribution" in reason for reason in decision.reasons)


def test_decide_abstention_ood_distance_ignored_when_not_configured() -> None:
    probabilities = np.array([0.95, 0.0125, 0.0125, 0.0125, 0.0125])
    decision = decide_abstention(
        probabilities, CLASSES, _thresholds(), quality_score=0.9, ood_distance=5.0
    )
    assert decision.should_abstain is False


def test_decide_abstention_uses_per_class_threshold_when_given() -> None:
    probabilities = np.array([0.6, 0.1, 0.1, 0.1, 0.1])
    # Global default (0.5) would pass, but a stricter per-class threshold fails it.
    decision = decide_abstention(
        probabilities,
        CLASSES,
        _thresholds(),
        quality_score=0.9,
        per_class_confidence_threshold=0.8,
    )
    assert decision.should_abstain is True


def test_decide_abstention_rejects_mismatched_probability_length() -> None:
    with pytest.raises(ValueError, match="expected"):
        decide_abstention(np.array([0.5, 0.5]), CLASSES, _thresholds(), quality_score=0.9)


def test_fit_feature_centroids_one_per_present_class() -> None:
    features = np.array([[1.0, 0.0], [1.2, 0.1], [0.0, 1.0], [-0.1, 1.1]])
    labels = np.array([0, 0, 1, 1])
    detector = fit_feature_centroids(features, labels, ("class_a", "class_b", "class_c"))
    assert set(detector.class_centroids.keys()) == {"class_a", "class_b"}
    np.testing.assert_allclose(detector.class_centroids["class_a"], [1.1, 0.05])


def test_fit_feature_centroids_rejects_empty_input() -> None:
    with pytest.raises(ValueError, match="zero samples"):
        fit_feature_centroids(np.zeros((0, 2)), np.zeros(0), ("a", "b"))


def test_distance_to_predicted_class_centroid_returns_none_for_unseen_class() -> None:
    features = np.array([[1.0, 0.0], [1.2, 0.1]])
    labels = np.array([0, 0])
    detector = fit_feature_centroids(features, labels, ("class_a", "class_b"))
    assert detector.distance_to_predicted_class_centroid(np.array([5.0, 5.0]), "class_b") is None


def test_distance_to_predicted_class_centroid_computes_euclidean_distance() -> None:
    features = np.array([[0.0, 0.0], [0.0, 0.0]])
    labels = np.array([0, 0])
    detector = fit_feature_centroids(features, labels, ("class_a",))
    distance = detector.distance_to_predicted_class_centroid(np.array([3.0, 4.0]), "class_a")
    assert distance == pytest.approx(5.0)
