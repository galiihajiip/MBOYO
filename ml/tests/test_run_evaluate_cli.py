"""End-to-end tests for ml/src/run_evaluate.py — mirrors
test_run_benchmark_cli.py's pattern (BLOCK 19): calling the CLI's own
module functions directly, not via subprocess."""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

import run_evaluate as run_evaluate_cli
from data_governance.manifest import ManifestRow, write_manifest

TRAINING_CONFIG: dict[str, object] = {
    "experiment_name": "test-eval-cli",
    "manifest_path": "data/manifests/split.csv",
    "random_seed": 7,
    "architectures": ["mobilenet_v3_large"],
    "resolutions_px": [224],
    "normalization": {"mean": [0.485, 0.456, 0.406], "std": [0.229, 0.224, 0.225]},
    "loss_functions": ["cross_entropy"],
    "focal_loss": {"gamma": 2.0},
    "sampler": {"weighted_random_sampler_candidate": False},
    "augmentation": {
        "horizontal_flip_probability": 0.5,
        "rotation_degrees": 15,
        "color_jitter": {"brightness": 0.3, "contrast": 0.3, "saturation": 0.2},
        "gaussian_blur_probability": 0.0,
        "gaussian_blur_kernel_size": 3,
    },
    "training": {
        "batch_size": 4,
        "max_epochs": 2,
        "learning_rate": 0.001,
        "weight_decay": 0.0001,
        "frozen_backbone_warmup_epochs": 1,
        "early_stopping_patience_epochs": 2,
        "early_stopping_min_delta": 0.001,
        "mixed_precision_when_available": True,
    },
    "smoke_test": {
        "synthetic_image_count_per_class": 6,
        "image_size_px": 48,
        "max_epochs": 1,
        "batch_size": 4,
    },
    "calibration": {"ece_bins": 5},
    "abstention_confidence_threshold": 0.5,
    "robustness": {"degradations": [{"name": "gaussian_blur", "kernel_size": 5}]},
    "two_stage_gate": {
        "enabled": False,
        "architecture": "mobilenet_v3_large",
        "resolution_px": 224,
    },
}

RELEASE_CRITERIA: dict[str, object] = {
    "macro_f1_min": 0.75,
    "destroyed_recall_min": 0.6,
    "calibration_error_max": 0.1,
    "min_test_set_sample_count": 30,
}


def _write_training_config(tmp_path: Path) -> Path:
    path = tmp_path / "training.yaml"
    path.write_text(yaml.safe_dump(TRAINING_CONFIG), encoding="utf-8")
    return path


def _write_release_criteria(tmp_path: Path) -> Path:
    path = tmp_path / "release_criteria.yaml"
    path.write_text(yaml.safe_dump(RELEASE_CRITERIA), encoding="utf-8")
    return path


@pytest.mark.slow
def test_smoke_test_runs_end_to_end_and_writes_a_report(tmp_path: Path) -> None:
    training_config_path = _write_training_config(tmp_path)
    release_criteria_path = _write_release_criteria(tmp_path)

    exit_code = run_evaluate_cli.run_smoke_test(training_config_path, release_criteria_path)
    assert exit_code == 0

    reports_dir = training_config_path.resolve().parent.parent / "reports"
    report_path = reports_dir / "smoke_test_evaluation.md"
    assert report_path.exists()
    content = report_path.read_text(encoding="utf-8")
    assert "Untouched Test-Set Evaluation" in content
    report_path.unlink()


def test_smoke_test_fails_gracefully_with_too_few_synthetic_images(tmp_path: Path) -> None:
    config = {
        **TRAINING_CONFIG,
        "smoke_test": {**TRAINING_CONFIG["smoke_test"], "synthetic_image_count_per_class": 1},  # type: ignore[dict-item]
    }
    path = tmp_path / "training.yaml"
    path.write_text(yaml.safe_dump(config), encoding="utf-8")
    release_criteria_path = _write_release_criteria(tmp_path)

    exit_code = run_evaluate_cli.run_smoke_test(path, release_criteria_path)
    assert exit_code == 1


def test_real_evaluation_exits_zero_when_no_checkpoint_exists(tmp_path: Path) -> None:
    dataset_config = {
        "dataset_name": "test",
        "schema_version": 1,
        "classes": ["no_damage", "minor_damage", "major_damage", "destroyed", "unknown"],
        "image_domains": ["ground_level"],
        "paths": {
            "raw": "data/raw",
            "interim": "data/interim",
            "processed": "data/processed",
            "manifests": "data/manifests",
            "reports": "reports",
        },
        "split": {
            "train": 0.7,
            "val": 0.15,
            "test": 0.15,
            "group_by": ["source_id"],
            "random_seed": 1,
        },
        "quality": {"min_width_px": 1, "min_height_px": 1, "max_file_size_mb": 25},
        "deduplicate": {
            "exact_hash_algorithm": "sha256",
            "perceptual_hash_size": 8,
            "near_duplicate_hamming_threshold": 4,
        },
        "privacy": {"flags": [], "exclude_flagged_from_split_by_default": True},
        "licensing": {"require_recorded_license": True, "unclear_license_treated_as": "excluded"},
    }
    dataset_config_path = tmp_path / "dataset.yaml"
    dataset_config_path.write_text(yaml.safe_dump(dataset_config), encoding="utf-8")

    training_config_path = _write_training_config(tmp_path)
    release_criteria_path = _write_release_criteria(tmp_path)
    (tmp_path / "data" / "manifests").mkdir(parents=True)

    exit_code = run_evaluate_cli.run_real_evaluation(
        training_config_path, dataset_config_path, release_criteria_path, checkpoint_path=None
    )
    assert exit_code == 0


def test_real_evaluation_exits_zero_when_manifest_missing_a_split(tmp_path: Path) -> None:
    dataset_config = {
        "dataset_name": "test",
        "schema_version": 1,
        "classes": ["no_damage", "minor_damage", "major_damage", "destroyed", "unknown"],
        "image_domains": ["ground_level"],
        "paths": {
            "raw": "data/raw",
            "interim": "data/interim",
            "processed": "data/processed",
            "manifests": "data/manifests",
            "reports": "reports",
        },
        "split": {
            "train": 0.7,
            "val": 0.15,
            "test": 0.15,
            "group_by": ["source_id"],
            "random_seed": 1,
        },
        "quality": {"min_width_px": 1, "min_height_px": 1, "max_file_size_mb": 25},
        "deduplicate": {
            "exact_hash_algorithm": "sha256",
            "perceptual_hash_size": 8,
            "near_duplicate_hamming_threshold": 4,
        },
        "privacy": {"flags": [], "exclude_flagged_from_split_by_default": True},
        "licensing": {"require_recorded_license": True, "unclear_license_treated_as": "excluded"},
    }
    dataset_config_path = tmp_path / "dataset.yaml"
    dataset_config_path.write_text(yaml.safe_dump(dataset_config), encoding="utf-8")

    training_config_path = _write_training_config(tmp_path)
    release_criteria_path = _write_release_criteria(tmp_path)

    # A checkpoint must exist for this path to get past the "no checkpoint"
    # check and reach the split-emptiness check — write a fake but
    # structurally-valid checkpoint.
    from training.checkpoints import CheckpointMetadata, save_checkpoint
    from training.models import build_model

    classes = ("no_damage", "minor_damage", "major_damage", "destroyed", "unknown")
    build_result = build_model("mobilenet_v3_large", num_classes=len(classes))
    models_dir = tmp_path / "models"
    checkpoint_path = models_dir / "mobilenet_v3_large_224px.pt"
    save_checkpoint(
        build_result.model,
        CheckpointMetadata(
            architecture="mobilenet_v3_large",
            resolution_px=224,
            classes=classes,
            epoch=1,
            validation_macro_f1=0.5,
        ),
        checkpoint_path,
    )

    manifest_path = tmp_path / "data" / "manifests" / "split.csv"
    write_manifest(
        [
            ManifestRow(
                image_id="a", source_id="s", relative_path="a.jpg", label="no_damage", split="train"
            )
        ],
        manifest_path,
    )

    exit_code = run_evaluate_cli.run_real_evaluation(
        training_config_path,
        dataset_config_path,
        release_criteria_path,
        checkpoint_path=checkpoint_path,
    )
    assert exit_code == 0
