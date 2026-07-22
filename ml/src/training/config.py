"""Loads and validates ml/configs/training.yaml into a typed structure.

Mirrors data_governance/config.py's pattern (BLOCK 18) — fail-fast,
explicit ConfigError, every downstream module trusts the loaded shape
completely rather than re-validating.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any

import yaml

DEFAULT_TRAINING_CONFIG_PATH = (
    Path(__file__).resolve().parent.parent.parent / "configs" / "training.yaml"
)

VALID_ARCHITECTURES = ("mobilenet_v3_large", "efficientnet_v2_s", "convnext_tiny")
VALID_LOSS_FUNCTIONS = ("cross_entropy", "class_weighted_cross_entropy", "focal_loss")


class TrainingConfigError(ValueError):
    """Raised when training.yaml is missing, malformed, or internally inconsistent."""


@dataclass(frozen=True)
class NormalizationConfig:
    mean: tuple[float, float, float]
    std: tuple[float, float, float]


@dataclass(frozen=True)
class ColorJitterConfig:
    brightness: float
    contrast: float
    saturation: float


@dataclass(frozen=True)
class AugmentationConfig:
    horizontal_flip_probability: float
    rotation_degrees: float
    color_jitter: ColorJitterConfig
    gaussian_blur_probability: float
    gaussian_blur_kernel_size: int


@dataclass(frozen=True)
class TrainingHyperparameters:
    batch_size: int
    max_epochs: int
    learning_rate: float
    weight_decay: float
    frozen_backbone_warmup_epochs: int
    early_stopping_patience_epochs: int
    early_stopping_min_delta: float
    mixed_precision_when_available: bool


@dataclass(frozen=True)
class SmokeTestConfig:
    synthetic_image_count_per_class: int
    image_size_px: int
    max_epochs: int
    batch_size: int


@dataclass(frozen=True)
class CalibrationConfig:
    ece_bins: int


@dataclass(frozen=True)
class Degradation:
    name: str
    params: dict[str, float]


@dataclass(frozen=True)
class RobustnessConfig:
    degradations: tuple[Degradation, ...]


@dataclass(frozen=True)
class TwoStageGateConfig:
    enabled: bool
    architecture: str
    resolution_px: int


@dataclass(frozen=True)
class TrainingConfig:
    experiment_name: str
    manifest_path: Path
    random_seed: int
    architectures: tuple[str, ...]
    resolutions_px: tuple[int, ...]
    normalization: NormalizationConfig
    loss_functions: tuple[str, ...]
    focal_loss_gamma: float
    sampler_candidate_enabled: bool
    augmentation: AugmentationConfig
    training: TrainingHyperparameters
    smoke_test: SmokeTestConfig
    calibration: CalibrationConfig
    abstention_confidence_threshold: float
    robustness: RobustnessConfig
    two_stage_gate: TwoStageGateConfig


def _require(data: dict[str, Any], key: str, config_path: Path) -> Any:  # noqa: ANN401
    if key not in data:
        raise TrainingConfigError(f"{config_path}: missing required key '{key}'")
    return data[key]


def load_training_config(config_path: Path = DEFAULT_TRAINING_CONFIG_PATH) -> TrainingConfig:
    if not config_path.exists():
        raise TrainingConfigError(f"Training config not found at {config_path}")

    with config_path.open("r", encoding="utf-8") as handle:
        raw = yaml.safe_load(handle)

    if not isinstance(raw, dict):
        raise TrainingConfigError(f"{config_path}: top level must be a mapping")

    architectures = tuple(_require(raw, "architectures", config_path))
    if len(architectures) == 0:
        raise TrainingConfigError(f"{config_path}: 'architectures' must not be empty")
    for arch in architectures:
        if arch not in VALID_ARCHITECTURES:
            raise TrainingConfigError(
                f"{config_path}: unknown architecture '{arch}', "
                f"must be one of {VALID_ARCHITECTURES}"
            )

    loss_functions = tuple(_require(raw, "loss_functions", config_path))
    for loss_name in loss_functions:
        if loss_name not in VALID_LOSS_FUNCTIONS:
            raise TrainingConfigError(
                f"{config_path}: unknown loss function '{loss_name}', "
                f"must be one of {VALID_LOSS_FUNCTIONS}"
            )

    resolutions = tuple(int(r) for r in _require(raw, "resolutions_px", config_path))
    if len(resolutions) == 0:
        raise TrainingConfigError(f"{config_path}: 'resolutions_px' must not be empty")

    norm_raw = _require(raw, "normalization", config_path)
    normalization = NormalizationConfig(
        mean=(float(norm_raw["mean"][0]), float(norm_raw["mean"][1]), float(norm_raw["mean"][2])),
        std=(float(norm_raw["std"][0]), float(norm_raw["std"][1]), float(norm_raw["std"][2])),
    )

    aug_raw = _require(raw, "augmentation", config_path)
    jitter_raw = aug_raw["color_jitter"]
    augmentation = AugmentationConfig(
        horizontal_flip_probability=float(aug_raw["horizontal_flip_probability"]),
        rotation_degrees=float(aug_raw["rotation_degrees"]),
        color_jitter=ColorJitterConfig(
            brightness=float(jitter_raw["brightness"]),
            contrast=float(jitter_raw["contrast"]),
            saturation=float(jitter_raw["saturation"]),
        ),
        gaussian_blur_probability=float(aug_raw["gaussian_blur_probability"]),
        gaussian_blur_kernel_size=int(aug_raw["gaussian_blur_kernel_size"]),
    )

    train_raw = _require(raw, "training", config_path)
    training = TrainingHyperparameters(
        batch_size=int(train_raw["batch_size"]),
        max_epochs=int(train_raw["max_epochs"]),
        learning_rate=float(train_raw["learning_rate"]),
        weight_decay=float(train_raw["weight_decay"]),
        frozen_backbone_warmup_epochs=int(train_raw["frozen_backbone_warmup_epochs"]),
        early_stopping_patience_epochs=int(train_raw["early_stopping_patience_epochs"]),
        early_stopping_min_delta=float(train_raw["early_stopping_min_delta"]),
        mixed_precision_when_available=bool(train_raw["mixed_precision_when_available"]),
    )

    smoke_raw = _require(raw, "smoke_test", config_path)
    smoke_test = SmokeTestConfig(
        synthetic_image_count_per_class=int(smoke_raw["synthetic_image_count_per_class"]),
        image_size_px=int(smoke_raw["image_size_px"]),
        max_epochs=int(smoke_raw["max_epochs"]),
        batch_size=int(smoke_raw["batch_size"]),
    )

    calibration_raw = _require(raw, "calibration", config_path)
    calibration = CalibrationConfig(ece_bins=int(calibration_raw["ece_bins"]))

    robustness_raw = _require(raw, "robustness", config_path)
    degradations = tuple(
        Degradation(
            name=str(d["name"]),
            params={k: float(v) for k, v in d.items() if k != "name"},
        )
        for d in robustness_raw["degradations"]
    )
    robustness = RobustnessConfig(degradations=degradations)

    gate_raw = _require(raw, "two_stage_gate", config_path)
    two_stage_gate = TwoStageGateConfig(
        enabled=bool(gate_raw["enabled"]),
        architecture=str(gate_raw["architecture"]),
        resolution_px=int(gate_raw["resolution_px"]),
    )

    config_root = config_path.resolve().parent.parent  # ml/configs/.. == ml/

    return TrainingConfig(
        experiment_name=str(_require(raw, "experiment_name", config_path)),
        manifest_path=(config_root / str(_require(raw, "manifest_path", config_path))).resolve(),
        random_seed=int(_require(raw, "random_seed", config_path)),
        architectures=architectures,
        resolutions_px=resolutions,
        normalization=normalization,
        loss_functions=loss_functions,
        focal_loss_gamma=float(raw["focal_loss"]["gamma"]),
        sampler_candidate_enabled=bool(raw["sampler"]["weighted_random_sampler_candidate"]),
        augmentation=augmentation,
        training=training,
        smoke_test=smoke_test,
        calibration=calibration,
        abstention_confidence_threshold=float(
            _require(raw, "abstention_confidence_threshold", config_path)
        ),
        robustness=robustness,
        two_stage_gate=two_stage_gate,
    )


def derive_smoke_test_training_config(config: TrainingConfig) -> TrainingConfig:
    """Returns a copy of `config` scoped down for CPU smoke-test mode: ONE
    architecture (the first/cheapest configured candidate) at ONE
    resolution (config.smoke_test.image_size_px, not the full
    resolutions_px sweep), `smoke_test.max_epochs` instead of the full
    `training.max_epochs`, and no sampler-candidate phase (the sampler
    variant adds a second Phase 1 training run for a signal this tiny
    synthetic dataset can't meaningfully measure anyway).

    This exists so `--smoke-test` is actually fast (proving the pipeline
    runs correctly end to end in seconds, per this block's "CPU smoke
    mode" requirement) rather than silently running the full production
    grid against a tiny dataset, which would be slow for no benefit — the
    full grid's cost comes from its breadth (3 architectures x 2
    resolutions x up to 4 loss/sampler candidates), not from dataset size,
    so shrinking only the dataset while keeping the full grid would not
    have produced a meaningfully faster smoke test."""
    return replace(
        config,
        architectures=(config.architectures[0],),
        resolutions_px=(config.smoke_test.image_size_px,),
        loss_functions=config.loss_functions[:1],
        sampler_candidate_enabled=False,
        training=replace(
            config.training,
            max_epochs=config.smoke_test.max_epochs,
            batch_size=config.smoke_test.batch_size,
            early_stopping_patience_epochs=config.smoke_test.max_epochs,
            frozen_backbone_warmup_epochs=min(
                config.training.frozen_backbone_warmup_epochs, config.smoke_test.max_epochs
            ),
        ),
    )
