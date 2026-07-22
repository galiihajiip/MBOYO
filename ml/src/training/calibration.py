"""Probability calibration (temperature scaling) and per-class confidence
thresholds — both fit ONLY on the validation split, never on the untouched
test split, so the test-set evaluation this block also builds remains a
genuinely held-out measurement of the calibrated model, not a number
inflated by fitting calibration parameters on the same data being scored.

Temperature scaling (Guo et al., 2017) is the standard, simplest
post-hoc calibration method: a single learned scalar `T` divides the
model's logits before softmax, changing confidence sharpness without
changing the argmax prediction (so accuracy/macro-F1 are unaffected —
only calibration error and downstream abstention decisions change).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import torch
from torch import nn


@dataclass(frozen=True)
class TemperatureScalingResult:
    temperature: float
    pre_calibration_ece: float
    post_calibration_ece: float


def fit_temperature(
    validation_logits: torch.Tensor,
    validation_labels: torch.Tensor,
    max_iterations: int = 50,
    learning_rate: float = 0.01,
) -> float:
    """Learns a single scalar temperature `T > 0` minimizing validation
    negative log-likelihood, via LBFGS (standard for this 1-parameter
    problem — full gradient descent is unnecessary and slower to converge).
    `validation_logits` is (n_samples, n_classes) raw (pre-softmax) output;
    `validation_labels` is (n_samples,) integer class indices."""
    if validation_logits.shape[0] == 0:
        raise ValueError("Cannot fit temperature on zero validation samples")

    log_temperature = torch.zeros(1, requires_grad=True)
    optimizer = torch.optim.LBFGS([log_temperature], lr=learning_rate, max_iter=max_iterations)
    nll_loss = nn.CrossEntropyLoss()

    def _closure() -> torch.Tensor:
        optimizer.zero_grad()
        temperature = torch.exp(log_temperature)
        loss: torch.Tensor = nll_loss(validation_logits / temperature, validation_labels)
        loss.backward()  # type: ignore[no-untyped-call]
        return loss

    optimizer.step(_closure)  # type: ignore[no-untyped-call]
    return float(torch.exp(log_temperature).item())


def apply_temperature(logits: torch.Tensor, temperature: float) -> torch.Tensor:
    """Returns calibrated softmax probabilities — `temperature` must be the
    positive scalar `fit_temperature` returned (or 1.0, meaning no-op)."""
    if temperature <= 0:
        raise ValueError(f"Temperature must be positive, got {temperature}")
    return torch.softmax(logits / temperature, dim=-1)


@dataclass(frozen=True)
class PerClassThresholds:
    """One confidence threshold per class, keyed by class name — replaces a
    single global `abstention_confidence_threshold` (BLOCK 19's
    TrainingConfig field) with a per-class value, since classes with fewer
    validation examples or more confusable neighbors (e.g. `minor_damage`
    vs `major_damage`) legitimately warrant a different confidence bar than
    a class the model separates cleanly."""

    thresholds: dict[str, float]

    def threshold_for(self, class_name: str, default: float) -> float:
        return self.thresholds.get(class_name, default)


def fit_per_class_thresholds(
    validation_probabilities: np.ndarray,
    validation_labels: np.ndarray,
    classes: tuple[str, ...],
    target_precision: float,
    default_threshold: float,
) -> PerClassThresholds:
    """For each class, picks the lowest confidence threshold whose
    validation-set precision (among predictions with confidence at or above
    that threshold) is still >= `target_precision` — the "highest recall
    achievable without dropping below the required precision floor" rule.
    Falls back to `default_threshold` for a class with too few validation
    predictions to fit a threshold reliably (fewer than 5 predicted
    positives at every candidate threshold), rather than fitting an
    unreliable threshold from a handful of samples."""
    if validation_probabilities.shape[0] == 0:
        raise ValueError("Cannot fit per-class thresholds on zero validation samples")

    predicted_classes = np.argmax(validation_probabilities, axis=1)
    top_confidences = np.max(validation_probabilities, axis=1)

    thresholds: dict[str, float] = {}
    candidate_thresholds = np.linspace(0.1, 0.99, 90)

    for class_index, class_name in enumerate(classes):
        is_predicted_this_class = predicted_classes == class_index
        best_threshold: float | None = None

        for candidate in candidate_thresholds:
            kept = is_predicted_this_class & (top_confidences >= candidate)
            kept_count = int(np.sum(kept))
            if kept_count < 5:
                continue

            correct_count = int(np.sum(kept & (validation_labels == class_index)))
            precision = correct_count / kept_count
            if precision >= target_precision:
                best_threshold = float(candidate)
                break

        thresholds[class_name] = best_threshold if best_threshold is not None else default_threshold

    return PerClassThresholds(thresholds=thresholds)
