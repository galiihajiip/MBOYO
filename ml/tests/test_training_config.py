from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from training.config import (
    TrainingConfigError,
    derive_smoke_test_training_config,
    load_training_config,
)

VALID_CONFIG: dict[str, object] = {
    "experiment_name": "test-experiment",
    "manifest_path": "data/manifests/split.csv",
    "random_seed": 42,
    "architectures": ["mobilenet_v3_large", "convnext_tiny"],
    "resolutions_px": [224, 288],
    "normalization": {"mean": [0.485, 0.456, 0.406], "std": [0.229, 0.224, 0.225]},
    "loss_functions": ["cross_entropy", "focal_loss"],
    "focal_loss": {"gamma": 2.0},
    "sampler": {"weighted_random_sampler_candidate": True},
    "augmentation": {
        "horizontal_flip_probability": 0.5,
        "rotation_degrees": 15,
        "color_jitter": {"brightness": 0.3, "contrast": 0.3, "saturation": 0.2},
        "gaussian_blur_probability": 0.15,
        "gaussian_blur_kernel_size": 5,
    },
    "training": {
        "batch_size": 32,
        "max_epochs": 30,
        "learning_rate": 0.0003,
        "weight_decay": 0.0001,
        "frozen_backbone_warmup_epochs": 3,
        "early_stopping_patience_epochs": 5,
        "early_stopping_min_delta": 0.001,
        "mixed_precision_when_available": True,
    },
    "smoke_test": {
        "synthetic_image_count_per_class": 6,
        "image_size_px": 64,
        "max_epochs": 2,
        "batch_size": 4,
    },
    "calibration": {"ece_bins": 10},
    "abstention_confidence_threshold": 0.5,
    "robustness": {"degradations": [{"name": "gaussian_blur", "kernel_size": 9}]},
    "two_stage_gate": {
        "enabled": False,
        "architecture": "mobilenet_v3_large",
        "resolution_px": 224,
    },
}


def _write_config(tmp_path: Path, overrides: dict[str, object] | None = None) -> Path:
    config = {**VALID_CONFIG, **(overrides or {})}
    path = tmp_path / "training.yaml"
    path.write_text(yaml.safe_dump(config), encoding="utf-8")
    return path


def test_loads_valid_config(tmp_path: Path) -> None:
    path = _write_config(tmp_path)
    config = load_training_config(path)

    assert config.experiment_name == "test-experiment"
    assert config.architectures == ("mobilenet_v3_large", "convnext_tiny")
    assert config.resolutions_px == (224, 288)
    assert config.loss_functions == ("cross_entropy", "focal_loss")
    assert config.manifest_path.name == "split.csv"


def test_missing_file_raises(tmp_path: Path) -> None:
    with pytest.raises(TrainingConfigError):
        load_training_config(tmp_path / "does-not-exist.yaml")


def test_unknown_architecture_raises(tmp_path: Path) -> None:
    path = _write_config(tmp_path, {"architectures": ["not_a_real_architecture"]})
    with pytest.raises(TrainingConfigError, match="unknown architecture"):
        load_training_config(path)


def test_empty_architectures_raises(tmp_path: Path) -> None:
    path = _write_config(tmp_path, {"architectures": []})
    with pytest.raises(TrainingConfigError, match="must not be empty"):
        load_training_config(path)


def test_unknown_loss_function_raises(tmp_path: Path) -> None:
    path = _write_config(tmp_path, {"loss_functions": ["not_a_real_loss"]})
    with pytest.raises(TrainingConfigError, match="unknown loss function"):
        load_training_config(path)


def test_derive_smoke_test_training_config_scopes_down(tmp_path: Path) -> None:
    path = _write_config(tmp_path)
    full_config = load_training_config(path)

    smoke_config = derive_smoke_test_training_config(full_config)

    assert smoke_config.architectures == (full_config.architectures[0],)
    assert smoke_config.resolutions_px == (full_config.smoke_test.image_size_px,)
    assert smoke_config.loss_functions == (full_config.loss_functions[0],)
    assert smoke_config.sampler_candidate_enabled is False
    assert smoke_config.training.max_epochs == full_config.smoke_test.max_epochs
    assert smoke_config.training.batch_size == full_config.smoke_test.batch_size


def test_derive_smoke_test_training_config_does_not_mutate_original(tmp_path: Path) -> None:
    path = _write_config(tmp_path)
    full_config = load_training_config(path)
    original_architectures = full_config.architectures

    derive_smoke_test_training_config(full_config)

    assert full_config.architectures == original_architectures
