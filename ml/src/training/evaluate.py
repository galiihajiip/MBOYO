"""Untouched-test-set evaluation — this block's central deliverable.

Ties together every other BLOCK 20 module into one pipeline that runs
against a single already-trained checkpoint (produced by BLOCK 19's
benchmark/training code):

  1. Load the checkpoint's model.
  2. Fit temperature scaling and per-class confidence thresholds on the
     VALIDATION split only (calibration.py).
  3. Evaluate ONCE on the untouched TEST split: confusion matrix,
     macro/micro/weighted F1, destroyed recall, per-class metrics, PR
     curves, calibration curve, ECE (using calibrated probabilities),
     abstention rate, per-sample abstain/needs_manual_review decisions
     (abstention.py).
  4. Measure CPU latency and model size (reusing BLOCK 19's latency.py/
     models.py) and robustness under blur/low-light/JPEG/low-resolution
     degradation (robustness.py, now including the low_resolution
     degradation added in this block).
  5. Apply the release gate (release_gate.py) to the test-set metrics —
     never to validation metrics — deciding promote vs. advisory-only.
  6. Render a Markdown evaluation report.

Per this block's explicit "never evaluate on training or validation data
as final evidence" requirement: `run_untouched_test_evaluation`'s
`test_rows` parameter is the ONLY data this module scores as the final,
reported result. `val_rows` is accepted solely to fit calibration
parameters — using it for anything reported as a metric would defeat the
purpose of holding out a test split at all.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader

from data_governance.manifest import ManifestRow

from .abstention import AbstentionDecision, AbstentionThresholds, decide_abstention
from .calibration import (
    PerClassThresholds,
    apply_temperature,
    fit_per_class_thresholds,
    fit_temperature,
)
from .dataset import ManifestImageDataset, build_transform
from .metrics import (
    CalibrationCurvePoint,
    ClassificationMetrics,
    ConfusionMatrix,
    PrecisionRecallCurve,
    compute_abstention_rate,
    compute_calibration_curve,
    compute_classification_metrics,
    compute_confusion_matrix,
    compute_expected_calibration_error,
    compute_precision_recall_curves,
)
from .models import resolve_device


@dataclass(frozen=True)
class EvaluationConfig:
    ece_bins: int
    default_abstention_confidence_threshold: float
    per_class_threshold_target_precision: float
    max_entropy_nats: float
    quality_score_min: float
    resolution_px: int
    batch_size: int


def _collect_logits_and_labels(
    model: torch.nn.Module,
    rows: list[ManifestRow],
    raw_dir: Path,
    classes: tuple[str, ...],
    resolution_px: int,
    normalization: tuple[tuple[float, float, float], tuple[float, float, float]],
    batch_size: int,
    device: torch.device,
) -> tuple[torch.Tensor, torch.Tensor]:
    """One forward pass over `rows`, returning raw (pre-softmax) logits and
    integer labels — the shared primitive every calibration/evaluation step
    below is computed from, so no split is ever scored via two different
    forward passes that could subtly diverge (e.g. under non-deterministic
    dropout, though eval mode disables that here regardless)."""
    mean, std = normalization
    transform = build_transform(resolution_px, mean, std, augment=False)
    dataset = ManifestImageDataset(rows, raw_dir, classes, transform)
    loader: DataLoader[tuple[torch.Tensor, int]] = DataLoader(
        dataset, batch_size=batch_size, shuffle=False
    )

    model.eval()
    model.to(device)
    all_logits = []
    all_labels = []
    with torch.no_grad():
        for images, labels in loader:
            images = images.to(device)
            logits = model(images)
            all_logits.append(logits.cpu())
            all_labels.append(labels)

    return torch.cat(all_logits, dim=0), torch.cat(all_labels, dim=0)


@dataclass(frozen=True)
class PerSampleAbstentionSummary:
    abstention_rate: float
    reason_counts: dict[str, int]


@dataclass(frozen=True)
class UntouchedTestEvaluationReport:
    generated_at: str
    dataset_identity: str
    classes: tuple[str, ...]
    test_sample_count: int
    temperature: float
    per_class_thresholds: PerClassThresholds
    metrics: ClassificationMetrics
    confusion_matrix: ConfusionMatrix
    precision_recall_curves: tuple[PrecisionRecallCurve, ...]
    calibration_curve: tuple[CalibrationCurvePoint, ...]
    calibration_error: float
    abstention_rate: float
    per_sample_abstention_reason_counts: dict[str, int]


def run_untouched_test_evaluation(
    model: torch.nn.Module,
    classes: tuple[str, ...],
    val_rows: list[ManifestRow],
    test_rows: list[ManifestRow],
    quality_scores_by_test_index: list[float],
    raw_dir: Path,
    normalization: tuple[tuple[float, float, float], tuple[float, float, float]],
    dataset_identity: str,
    config: EvaluationConfig,
) -> UntouchedTestEvaluationReport:
    """`quality_scores_by_test_index` must be the same length and order as
    `test_rows` — a per-sample quality signal (per RISK_REGISTER.md risk #4)
    fed into the abstention decision alongside confidence/entropy; this
    module does not compute image quality itself (that is
    data_governance's job from BLOCK 18), only consumes an already-computed
    score.
    """
    if len(test_rows) == 0:
        raise ValueError("Cannot evaluate on zero test rows — refusing to fabricate a report")
    if len(quality_scores_by_test_index) != len(test_rows):
        raise ValueError(
            f"quality_scores_by_test_index has {len(quality_scores_by_test_index)} entries, "
            f"expected {len(test_rows)} to match test_rows"
        )

    device = resolve_device()

    # Step 1: fit calibration on VALIDATION only.
    val_logits, val_labels = _collect_logits_and_labels(
        model,
        val_rows,
        raw_dir,
        classes,
        config.resolution_px,
        normalization,
        config.batch_size,
        device,
    )
    temperature = fit_temperature(val_logits, val_labels)
    val_probabilities = apply_temperature(val_logits, temperature).numpy()
    per_class_thresholds = fit_per_class_thresholds(
        val_probabilities,
        val_labels.numpy(),
        classes,
        config.per_class_threshold_target_precision,
        config.default_abstention_confidence_threshold,
    )

    # Step 2: evaluate ONCE on the untouched test split, using the
    # calibration parameters fit above (never refit on test data).
    test_logits, test_labels = _collect_logits_and_labels(
        model,
        test_rows,
        raw_dir,
        classes,
        config.resolution_px,
        normalization,
        config.batch_size,
        device,
    )
    test_probabilities_tensor = apply_temperature(test_logits, temperature)
    test_probabilities = test_probabilities_tensor.numpy()
    test_predictions = np.argmax(test_probabilities, axis=1)
    test_labels_array = test_labels.numpy()
    test_confidences = np.max(test_probabilities, axis=1)
    test_correct = (test_predictions == test_labels_array).astype(float)

    metrics = compute_classification_metrics(test_labels_array, test_predictions, classes)
    confusion = compute_confusion_matrix(test_labels_array, test_predictions, classes)
    pr_curves = compute_precision_recall_curves(test_labels_array, test_probabilities, classes)
    calibration_curve = compute_calibration_curve(
        test_confidences, test_correct, num_bins=config.ece_bins
    )
    ece = compute_expected_calibration_error(
        test_confidences, test_correct, num_bins=config.ece_bins
    )
    abstention_rate = compute_abstention_rate(
        test_confidences, config.default_abstention_confidence_threshold
    )

    abstention_thresholds = AbstentionThresholds(
        max_entropy_nats=config.max_entropy_nats,
        quality_score_min=config.quality_score_min,
        ood_distance_max=None,
        default_confidence_threshold=config.default_abstention_confidence_threshold,
    )
    reason_counts: dict[str, int] = {}
    for sample_index in range(len(test_rows)):
        predicted_class_name = classes[int(test_predictions[sample_index])]
        decision: AbstentionDecision = decide_abstention(
            test_probabilities[sample_index],
            classes,
            abstention_thresholds,
            quality_scores_by_test_index[sample_index],
            per_class_confidence_threshold=per_class_thresholds.threshold_for(
                predicted_class_name, config.default_abstention_confidence_threshold
            ),
        )
        for reason in decision.reasons:
            reason_key = reason.split(":")[0]
            reason_counts[reason_key] = reason_counts.get(reason_key, 0) + 1

    return UntouchedTestEvaluationReport(
        generated_at=datetime.now(UTC).isoformat(),
        dataset_identity=dataset_identity,
        classes=classes,
        test_sample_count=len(test_rows),
        temperature=temperature,
        per_class_thresholds=per_class_thresholds,
        metrics=metrics,
        confusion_matrix=confusion,
        precision_recall_curves=pr_curves,
        calibration_curve=calibration_curve,
        calibration_error=ece,
        abstention_rate=abstention_rate,
        per_sample_abstention_reason_counts=reason_counts,
    )
