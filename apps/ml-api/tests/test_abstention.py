from __future__ import annotations

import numpy as np

from app.abstention import compute_entropy, decide_abstention


def test_decide_abstention_flags_low_confidence() -> None:
    probabilities = np.array([0.3, 0.2, 0.2, 0.15, 0.15])
    decision = decide_abstention(probabilities, quality_score=0.9)
    assert decision.abstained
    assert any("low_confidence" in reason for reason in decision.reasons)


def test_decide_abstention_flags_high_entropy() -> None:
    probabilities = np.array([0.21, 0.2, 0.2, 0.2, 0.19])
    decision = decide_abstention(probabilities, quality_score=0.9, confidence_threshold=0.1)
    assert decision.abstained
    assert any("high_entropy" in reason for reason in decision.reasons)


def test_decide_abstention_flags_quality_gate_failure() -> None:
    probabilities = np.array([0.9, 0.025, 0.025, 0.025, 0.025])
    decision = decide_abstention(probabilities, quality_score=0.1)
    assert decision.abstained
    assert any("quality_gate_failure" in reason for reason in decision.reasons)


def test_decide_abstention_does_not_fire_for_a_confident_high_quality_prediction() -> None:
    probabilities = np.array([0.95, 0.0125, 0.0125, 0.0125, 0.0125])
    decision = decide_abstention(probabilities, quality_score=0.9)
    assert not decision.abstained
    assert decision.reasons == ()


def test_compute_entropy_is_near_zero_for_a_one_hot_distribution() -> None:
    # Not exactly 0.0 — compute_entropy clips probabilities away from 0 by a
    # small epsilon to avoid log(0), so a perfectly one-hot input yields a
    # tiny but nonzero entropy rather than a mathematically exact zero.
    probabilities = np.array([1.0, 0.0, 0.0, 0.0, 0.0])
    assert compute_entropy(probabilities) < 1e-6


def test_compute_entropy_is_maximal_for_a_uniform_distribution() -> None:
    probabilities = np.array([0.2, 0.2, 0.2, 0.2, 0.2])
    entropy = compute_entropy(probabilities)
    assert entropy > 1.5
