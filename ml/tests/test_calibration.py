from __future__ import annotations

import numpy as np
import pytest
import torch

from training.calibration import (
    apply_temperature,
    fit_per_class_thresholds,
    fit_temperature,
)


def test_fit_temperature_returns_positive_scalar() -> None:
    torch.manual_seed(0)
    logits = torch.randn(50, 5) * 3
    labels = torch.randint(0, 5, (50,))
    temperature = fit_temperature(logits, labels)
    assert temperature > 0


def test_fit_temperature_rejects_empty_input() -> None:
    with pytest.raises(ValueError, match="zero validation samples"):
        fit_temperature(torch.zeros(0, 5), torch.zeros(0, dtype=torch.long))


def test_apply_temperature_preserves_argmax() -> None:
    """Temperature scaling must not change which class is predicted —
    only the sharpness of the confidence."""
    logits = torch.tensor([[1.0, 5.0, 0.5]])
    original_argmax = torch.argmax(logits, dim=-1)

    calibrated = apply_temperature(logits, temperature=2.5)
    calibrated_argmax = torch.argmax(calibrated, dim=-1)

    assert torch.equal(original_argmax, calibrated_argmax)


def test_apply_temperature_above_one_reduces_confidence() -> None:
    logits = torch.tensor([[1.0, 5.0, 0.5]])
    sharp = apply_temperature(logits, temperature=1.0)
    softened = apply_temperature(logits, temperature=5.0)
    assert softened.max().item() < sharp.max().item()


def test_apply_temperature_rejects_non_positive_temperature() -> None:
    logits = torch.tensor([[1.0, 2.0]])
    with pytest.raises(ValueError, match="must be positive"):
        apply_temperature(logits, temperature=0.0)


CLASSES = ("no_damage", "minor_damage", "major_damage", "destroyed", "unknown")


def test_fit_per_class_thresholds_returns_one_per_class() -> None:
    rng = np.random.default_rng(0)
    probabilities = rng.dirichlet(np.ones(5), size=200)
    labels = np.argmax(probabilities, axis=1)  # make predictions mostly "correct"

    thresholds = fit_per_class_thresholds(
        probabilities, labels, CLASSES, target_precision=0.6, default_threshold=0.5
    )
    assert set(thresholds.thresholds.keys()) == set(CLASSES)


def test_fit_per_class_thresholds_falls_back_to_default_with_too_few_samples() -> None:
    # Only 2 samples total -> every class has far fewer than 5 predicted
    # positives at every candidate threshold, so every class should fall
    # back to the default.
    probabilities = np.array([[0.9, 0.02, 0.02, 0.03, 0.03], [0.02, 0.9, 0.02, 0.03, 0.03]])
    labels = np.array([0, 1])

    thresholds = fit_per_class_thresholds(
        probabilities, labels, CLASSES, target_precision=0.9, default_threshold=0.42
    )
    assert all(v == 0.42 for v in thresholds.thresholds.values())


def test_fit_per_class_thresholds_rejects_empty_input() -> None:
    with pytest.raises(ValueError, match="zero validation samples"):
        fit_per_class_thresholds(np.zeros((0, 5)), np.zeros(0), CLASSES, 0.7, 0.5)


def test_threshold_for_uses_default_when_class_missing() -> None:
    from training.calibration import PerClassThresholds

    thresholds = PerClassThresholds(thresholds={"no_damage": 0.6})
    assert thresholds.threshold_for("no_damage", default=0.5) == 0.6
    assert thresholds.threshold_for("unknown", default=0.5) == 0.5
