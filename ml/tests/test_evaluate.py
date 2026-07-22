from __future__ import annotations

from pathlib import Path

import pytest

from training.evaluate import EvaluationConfig, run_untouched_test_evaluation
from training.models import build_model
from training.smoke_test_data import generate_smoke_test_dataset

CLASSES = ("unknown", "no_damage", "minor_damage", "major_damage", "destroyed")
NORMALIZATION = ((0.485, 0.456, 0.406), (0.229, 0.224, 0.225))


def _config(resolution_px: int = 32, ece_bins: int = 5) -> EvaluationConfig:
    return EvaluationConfig(
        ece_bins=ece_bins,
        default_abstention_confidence_threshold=0.5,
        per_class_threshold_target_precision=0.7,
        max_entropy_nats=1.5,
        quality_score_min=0.3,
        resolution_px=resolution_px,
        batch_size=4,
    )


def test_run_untouched_test_evaluation_produces_a_full_report(tmp_path: Path) -> None:
    rows = generate_smoke_test_dataset(tmp_path, CLASSES, images_per_class=6, image_size_px=32)
    val_rows = [r for r in rows if r.split == "val"]
    test_rows = [r for r in rows if r.split == "test"]

    build_result = build_model("mobilenet_v3_large", num_classes=len(CLASSES))

    report = run_untouched_test_evaluation(
        build_result.model,
        CLASSES,
        val_rows,
        test_rows,
        quality_scores_by_test_index=[0.9] * len(test_rows),
        raw_dir=tmp_path,
        normalization=NORMALIZATION,
        dataset_identity="smoke-test-synthetic",
        config=_config(),
    )

    assert report.test_sample_count == len(test_rows)
    assert report.dataset_identity == "smoke-test-synthetic"
    assert 0.0 <= report.metrics.macro_f1 <= 1.0
    assert len(report.confusion_matrix.matrix) == len(CLASSES)
    assert len(report.precision_recall_curves) == len(CLASSES)
    assert report.temperature > 0
    assert set(report.per_class_thresholds.thresholds.keys()) == set(CLASSES)


def test_run_untouched_test_evaluation_rejects_empty_test_rows(tmp_path: Path) -> None:
    rows = generate_smoke_test_dataset(tmp_path, CLASSES, images_per_class=6, image_size_px=32)
    val_rows = [r for r in rows if r.split == "val"]
    build_result = build_model("mobilenet_v3_large", num_classes=len(CLASSES))

    with pytest.raises(ValueError, match="zero test rows"):
        run_untouched_test_evaluation(
            build_result.model,
            CLASSES,
            val_rows,
            [],
            quality_scores_by_test_index=[],
            raw_dir=tmp_path,
            normalization=NORMALIZATION,
            dataset_identity="smoke-test-synthetic",
            config=_config(),
        )


def test_run_untouched_test_evaluation_rejects_mismatched_quality_scores(tmp_path: Path) -> None:
    rows = generate_smoke_test_dataset(tmp_path, CLASSES, images_per_class=6, image_size_px=32)
    val_rows = [r for r in rows if r.split == "val"]
    test_rows = [r for r in rows if r.split == "test"]
    build_result = build_model("mobilenet_v3_large", num_classes=len(CLASSES))

    with pytest.raises(ValueError, match="quality_scores_by_test_index"):
        run_untouched_test_evaluation(
            build_result.model,
            CLASSES,
            val_rows,
            test_rows,
            quality_scores_by_test_index=[0.9],  # wrong length
            raw_dir=tmp_path,
            normalization=NORMALIZATION,
            dataset_identity="smoke-test-synthetic",
            config=_config(),
        )


def test_low_quality_scores_increase_abstention_reason_counts(tmp_path: Path) -> None:
    rows = generate_smoke_test_dataset(tmp_path, CLASSES, images_per_class=6, image_size_px=32)
    val_rows = [r for r in rows if r.split == "val"]
    test_rows = [r for r in rows if r.split == "test"]
    build_result = build_model("mobilenet_v3_large", num_classes=len(CLASSES))

    report = run_untouched_test_evaluation(
        build_result.model,
        CLASSES,
        val_rows,
        test_rows,
        quality_scores_by_test_index=[0.0] * len(test_rows),  # force quality-gate failure
        raw_dir=tmp_path,
        normalization=NORMALIZATION,
        dataset_identity="smoke-test-synthetic",
        config=_config(),
    )
    assert report.per_sample_abstention_reason_counts.get("quality_gate_failure", 0) == len(
        test_rows
    )
