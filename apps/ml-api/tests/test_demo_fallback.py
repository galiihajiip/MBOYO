from __future__ import annotations

from app.demo_fallback import compute_demo_fallback


def test_demo_fallback_is_deterministic_for_the_same_input() -> None:
    image_bytes = b"some fake image bytes for testing"
    first = compute_demo_fallback(image_bytes)
    second = compute_demo_fallback(image_bytes)
    assert first == second


def test_demo_fallback_differs_for_different_input() -> None:
    first = compute_demo_fallback(b"image one")
    second = compute_demo_fallback(b"image two")
    # Not guaranteed to differ for every possible pair (5 buckets), but this
    # specific pair is chosen because it's verified to land in different
    # buckets — a regression here would mean the hash-to-class mapping broke.
    assert first.predicted_class != second.predicted_class


def test_demo_fallback_probabilities_sum_to_one() -> None:
    result = compute_demo_fallback(b"any bytes")
    assert abs(sum(result.probabilities.values()) - 1.0) < 1e-9


def test_demo_fallback_predicted_class_has_the_highest_probability() -> None:
    result = compute_demo_fallback(b"any bytes")
    assert result.probabilities[result.predicted_class] == max(result.probabilities.values())
