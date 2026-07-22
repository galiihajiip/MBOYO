"""Evaluation metrics — every one matches a definition already documented in
docs/product/SUCCESS_METRICS.md (macro-F1, destroyed recall, calibration
error, abstention rate) or is an explicit per-class/robustness breakdown this
block's selection criteria require. Computed only from scikit-learn (already
a dependency) plus hand-written ECE (sklearn has no ECE implementation) —
never from a fabricated or assumed number, per AGENTS.md's ML honesty rules
applied to this module's own outputs.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from sklearn.metrics import (
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_recall_fscore_support,
    recall_score,
)


@dataclass(frozen=True)
class PerClassMetrics:
    class_name: str
    precision: float
    recall: float
    f1: float
    support: int


@dataclass(frozen=True)
class ClassificationMetrics:
    macro_f1: float
    destroyed_recall: float | None
    per_class: tuple[PerClassMetrics, ...]
    accuracy: float
    sample_count: int
    micro_f1: float = 0.0
    weighted_f1: float = 0.0


@dataclass(frozen=True)
class ConfusionMatrix:
    """Row i, column j = count of true-class-i samples predicted as class j,
    in the same class order as `classes` passed to the computing function."""

    classes: tuple[str, ...]
    matrix: tuple[tuple[int, ...], ...]


@dataclass(frozen=True)
class PrecisionRecallCurve:
    class_name: str
    precisions: tuple[float, ...]
    recalls: tuple[float, ...]
    thresholds: tuple[float, ...]


@dataclass(frozen=True)
class CalibrationCurvePoint:
    bin_lower: float
    bin_upper: float
    mean_confidence: float
    accuracy: float
    sample_count: int


def compute_classification_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    classes: tuple[str, ...],
    destroyed_class_name: str = "destroyed",
) -> ClassificationMetrics:
    """macro_f1 averages over ALL classes in `classes` equally (per
    docs/product/SUCCESS_METRICS.md's Macro-F1 definition, which explicitly
    includes `unknown` alongside the four severity levels) — never silently
    drops a class with zero support from the average, since scikit-learn's
    macro average already handles a zero-support class correctly (as 0 F1
    for that class, per its own `zero_division` handling), which is what
    "treating each class equally regardless of frequency" requires.

    destroyed_recall is None (not 0.0) when the destroyed class has zero
    true examples in y_true — recall is undefined on an empty class, and
    reporting a fabricated 0.0 would misrepresent "no destroyed examples in
    this evaluation set" as "the model missed every destroyed example,"
    which are different, non-interchangeable facts."""
    if len(y_true) == 0:
        raise ValueError("Cannot compute metrics on zero samples")

    label_indices = list(range(len(classes)))

    macro_f1 = float(
        f1_score(y_true, y_pred, labels=label_indices, average="macro", zero_division=0)
    )
    micro_f1 = float(
        f1_score(y_true, y_pred, labels=label_indices, average="micro", zero_division=0)
    )
    weighted_f1 = float(
        f1_score(y_true, y_pred, labels=label_indices, average="weighted", zero_division=0)
    )
    accuracy = float(np.mean(y_true == y_pred))

    precisions, recalls, f1s, supports = precision_recall_fscore_support(
        y_true, y_pred, labels=label_indices, average=None, zero_division=0
    )
    per_class = tuple(
        PerClassMetrics(
            class_name=classes[i],
            precision=float(precisions[i]),
            recall=float(recalls[i]),
            f1=float(f1s[i]),
            support=int(supports[i]),
        )
        for i in range(len(classes))
    )

    destroyed_index = (
        classes.index(destroyed_class_name) if destroyed_class_name in classes else None
    )
    destroyed_recall: float | None = None
    if destroyed_index is not None:
        destroyed_support = int(np.sum(y_true == destroyed_index))
        if destroyed_support > 0:
            destroyed_recall = float(
                recall_score(
                    y_true, y_pred, labels=[destroyed_index], average="macro", zero_division=0
                )
            )

    return ClassificationMetrics(
        macro_f1=macro_f1,
        destroyed_recall=destroyed_recall,
        per_class=per_class,
        accuracy=accuracy,
        sample_count=len(y_true),
        micro_f1=micro_f1,
        weighted_f1=weighted_f1,
    )


def compute_confusion_matrix(
    y_true: np.ndarray, y_pred: np.ndarray, classes: tuple[str, ...]
) -> ConfusionMatrix:
    """Row-true, column-predicted, in `classes` order — the raw error
    pattern a scalar macro-F1 cannot show (e.g. which specific class a
    `destroyed` image gets misclassified as)."""
    if len(y_true) == 0:
        raise ValueError("Cannot compute a confusion matrix on zero samples")

    label_indices = list(range(len(classes)))
    matrix = confusion_matrix(y_true, y_pred, labels=label_indices)
    return ConfusionMatrix(
        classes=classes,
        matrix=tuple(tuple(int(v) for v in row) for row in matrix),
    )


def compute_precision_recall_curves(
    y_true: np.ndarray, class_probabilities: np.ndarray, classes: tuple[str, ...]
) -> tuple[PrecisionRecallCurve, ...]:
    """One-vs-rest PR curve per class — `class_probabilities` is an
    (n_samples, n_classes) array of the model's full softmax output (not
    just the top-1 prediction), since a PR curve needs the probability of
    each class at every sample, not merely the predicted label."""
    if len(y_true) == 0:
        raise ValueError("Cannot compute PR curves on zero samples")

    curves = []
    for class_index, class_name in enumerate(classes):
        binary_true = (y_true == class_index).astype(int)
        precisions, recalls, thresholds = precision_recall_curve(
            binary_true, class_probabilities[:, class_index]
        )
        curves.append(
            PrecisionRecallCurve(
                class_name=class_name,
                precisions=tuple(float(p) for p in precisions),
                recalls=tuple(float(r) for r in recalls),
                thresholds=tuple(float(t) for t in thresholds),
            )
        )
    return tuple(curves)


def compute_calibration_curve(
    confidences: np.ndarray, correct: np.ndarray, num_bins: int = 10
) -> tuple[CalibrationCurvePoint, ...]:
    """The reliability-diagram data behind `compute_expected_calibration_error`'s
    scalar ECE — one point per bin (skipping empty bins) so a report can
    plot confidence-vs-accuracy rather than only stating a single number."""
    if len(confidences) == 0:
        raise ValueError("Cannot compute a calibration curve on zero samples")

    bin_boundaries = np.linspace(0.0, 1.0, num_bins + 1)
    points = []
    for i in range(num_bins):
        lower, upper = bin_boundaries[i], bin_boundaries[i + 1]
        if i == num_bins - 1:
            in_bin = (confidences >= lower) & (confidences <= upper)
        else:
            in_bin = (confidences >= lower) & (confidences < upper)

        bin_count = int(np.sum(in_bin))
        if bin_count == 0:
            continue

        points.append(
            CalibrationCurvePoint(
                bin_lower=float(lower),
                bin_upper=float(upper),
                mean_confidence=float(np.mean(confidences[in_bin])),
                accuracy=float(np.mean(correct[in_bin])),
                sample_count=bin_count,
            )
        )
    return tuple(points)


def compute_expected_calibration_error(
    confidences: np.ndarray, correct: np.ndarray, num_bins: int = 10
) -> float:
    """Expected Calibration Error (Guo et al., 2017): bins predictions by
    their reported confidence, and for each bin compares the bin's mean
    confidence to its actual accuracy — ECE is the confidence-weighted
    average of |confidence - accuracy| across bins. A perfectly calibrated
    model (confidence always matches empirical accuracy) has ECE = 0; this
    never asserts a "good" ECE threshold itself (that is a release-gate
    config concern per SUCCESS_METRICS.md, deferred to a future block per
    BLOCK 18's own precedent) — it only measures."""
    if len(confidences) == 0:
        raise ValueError("Cannot compute ECE on zero samples")

    bin_boundaries = np.linspace(0.0, 1.0, num_bins + 1)
    total = len(confidences)
    ece = 0.0

    for i in range(num_bins):
        lower, upper = bin_boundaries[i], bin_boundaries[i + 1]
        # Last bin is inclusive on the upper bound (confidence can equal 1.0).
        if i == num_bins - 1:
            in_bin = (confidences >= lower) & (confidences <= upper)
        else:
            in_bin = (confidences >= lower) & (confidences < upper)

        bin_count = int(np.sum(in_bin))
        if bin_count == 0:
            continue

        bin_confidence = float(np.mean(confidences[in_bin]))
        bin_accuracy = float(np.mean(correct[in_bin]))
        ece += (bin_count / total) * abs(bin_confidence - bin_accuracy)

    return ece


def compute_abstention_rate(confidences: np.ndarray, threshold: float) -> float:
    """Fraction of predictions whose top confidence falls below `threshold` —
    per SUCCESS_METRICS.md's Abstention rate definition, these are inputs
    the model should route to full manual review rather than offer a
    classification for."""
    if len(confidences) == 0:
        raise ValueError("Cannot compute abstention rate on zero samples")
    return float(np.mean(confidences < threshold))
