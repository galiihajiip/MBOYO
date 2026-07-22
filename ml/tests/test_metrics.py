from __future__ import annotations

import numpy as np
import pytest

from training.metrics import (
    compute_abstention_rate,
    compute_calibration_curve,
    compute_classification_metrics,
    compute_confusion_matrix,
    compute_expected_calibration_error,
    compute_precision_recall_curves,
)

CLASSES = ("no_damage", "minor_damage", "major_damage", "destroyed", "unknown")


def test_perfect_predictions_yield_macro_f1_of_one() -> None:
    y_true = np.array([0, 1, 2, 3, 4])
    y_pred = np.array([0, 1, 2, 3, 4])
    metrics = compute_classification_metrics(y_true, y_pred, CLASSES)
    assert metrics.macro_f1 == pytest.approx(1.0)
    assert metrics.accuracy == pytest.approx(1.0)


def test_destroyed_recall_reflects_misclassification() -> None:
    y_true = np.array([3, 3, 3])
    y_pred = np.array([3, 3, 2])  # one destroyed misclassified as major_damage
    metrics = compute_classification_metrics(y_true, y_pred, CLASSES)
    assert metrics.destroyed_recall == pytest.approx(2 / 3)


def test_destroyed_recall_is_none_when_class_absent() -> None:
    y_true = np.array([0, 0, 1, 1])
    y_pred = np.array([0, 1, 1, 1])
    metrics = compute_classification_metrics(y_true, y_pred, CLASSES)
    assert metrics.destroyed_recall is None


def test_macro_f1_penalized_by_zero_support_classes() -> None:
    """Only two of five classes appear at all — macro-F1 must still average
    over all 5 (per SUCCESS_METRICS.md's explicit definition), not just the
    classes that happened to appear."""
    y_true = np.array([0, 0, 0, 0])
    y_pred = np.array([0, 0, 0, 0])
    metrics = compute_classification_metrics(y_true, y_pred, CLASSES)
    # Perfect on the one class present, but 0 F1 on the four absent classes
    # (zero_division=0) -> macro average is far below 1.0.
    assert metrics.macro_f1 == pytest.approx(1.0 / 5)


def test_compute_classification_metrics_rejects_empty_input() -> None:
    with pytest.raises(ValueError, match="zero samples"):
        compute_classification_metrics(np.array([]), np.array([]), CLASSES)


def test_per_class_metrics_cover_every_class() -> None:
    y_true = np.array([0, 1])
    y_pred = np.array([0, 1])
    metrics = compute_classification_metrics(y_true, y_pred, CLASSES)
    assert len(metrics.per_class) == len(CLASSES)
    assert {pc.class_name for pc in metrics.per_class} == set(CLASSES)


def test_ece_is_zero_for_perfectly_calibrated_predictions() -> None:
    # 100 samples at confidence 0.7, exactly 70 correct -> perfectly calibrated for this bin.
    confidences = np.full(100, 0.7)
    correct = np.array([1.0] * 70 + [0.0] * 30)
    ece = compute_expected_calibration_error(confidences, correct, num_bins=10)
    assert ece == pytest.approx(0.0, abs=1e-6)


def test_ece_is_high_for_overconfident_wrong_predictions() -> None:
    confidences = np.full(50, 0.99)
    correct = np.zeros(50)  # always wrong despite near-100% confidence
    ece = compute_expected_calibration_error(confidences, correct, num_bins=10)
    assert ece == pytest.approx(0.99, abs=0.05)


def test_ece_rejects_empty_input() -> None:
    with pytest.raises(ValueError, match="zero samples"):
        compute_expected_calibration_error(np.array([]), np.array([]))


def test_abstention_rate_counts_below_threshold_fraction() -> None:
    confidences = np.array([0.9, 0.9, 0.3, 0.3])
    rate = compute_abstention_rate(confidences, threshold=0.5)
    assert rate == pytest.approx(0.5)


def test_abstention_rate_rejects_empty_input() -> None:
    with pytest.raises(ValueError, match="zero samples"):
        compute_abstention_rate(np.array([]), threshold=0.5)


def test_micro_and_weighted_f1_are_populated() -> None:
    y_true = np.array([0, 0, 0, 0])
    y_pred = np.array([0, 0, 0, 0])
    metrics = compute_classification_metrics(y_true, y_pred, CLASSES)
    # Perfect predictions only on the one class present -> micro-F1 (which
    # ignores absent classes, unlike macro) is a perfect 1.0.
    assert metrics.micro_f1 == pytest.approx(1.0)
    assert metrics.weighted_f1 == pytest.approx(1.0)


def test_confusion_matrix_diagonal_for_perfect_predictions() -> None:
    y_true = np.array([0, 1, 2, 3, 4])
    y_pred = np.array([0, 1, 2, 3, 4])
    cm = compute_confusion_matrix(y_true, y_pred, CLASSES)
    assert cm.classes == CLASSES
    for i in range(len(CLASSES)):
        assert cm.matrix[i][i] == 1
        assert sum(cm.matrix[i]) == 1


def test_confusion_matrix_records_misclassification_off_diagonal() -> None:
    y_true = np.array([3, 3, 3])
    y_pred = np.array([3, 3, 2])
    cm = compute_confusion_matrix(y_true, y_pred, CLASSES)
    assert cm.matrix[3][3] == 2  # destroyed correctly predicted twice
    assert cm.matrix[3][2] == 1  # destroyed misclassified as major_damage once


def test_confusion_matrix_rejects_empty_input() -> None:
    with pytest.raises(ValueError, match="zero samples"):
        compute_confusion_matrix(np.array([]), np.array([]), CLASSES)


def test_precision_recall_curves_one_per_class() -> None:
    y_true = np.array([0, 1, 2, 3, 4])
    probabilities = np.eye(5)  # perfectly confident, correct one-hot rows
    curves = compute_precision_recall_curves(y_true, probabilities, CLASSES)
    assert len(curves) == len(CLASSES)
    assert {c.class_name for c in curves} == set(CLASSES)
    # A perfectly separable class should reach precision=1, recall=1 somewhere.
    for curve in curves:
        assert max(curve.precisions) == pytest.approx(1.0)


def test_precision_recall_curves_reject_empty_input() -> None:
    with pytest.raises(ValueError, match="zero samples"):
        compute_precision_recall_curves(np.array([]), np.zeros((0, 5)), CLASSES)


def test_calibration_curve_matches_ece_bin_shape() -> None:
    confidences = np.full(100, 0.7)
    correct = np.array([1.0] * 70 + [0.0] * 30)
    curve = compute_calibration_curve(confidences, correct, num_bins=10)
    assert len(curve) == 1  # all samples fall in the same [0.7, 0.8) bin
    assert curve[0].mean_confidence == pytest.approx(0.7)
    assert curve[0].accuracy == pytest.approx(0.7)
    assert curve[0].sample_count == 100


def test_calibration_curve_skips_empty_bins() -> None:
    confidences = np.array([0.05, 0.95])
    correct = np.array([1.0, 1.0])
    curve = compute_calibration_curve(confidences, correct, num_bins=10)
    assert len(curve) == 2  # only the two occupied bins, not all 10


def test_calibration_curve_rejects_empty_input() -> None:
    with pytest.raises(ValueError, match="zero samples"):
        compute_calibration_curve(np.array([]), np.array([]))
