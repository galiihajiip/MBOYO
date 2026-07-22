"""Loads and validates ml/configs/dataset.yaml into a typed structure.

Every script in this pipeline (prepare_data, audit, split, deduplicate)
loads config through this module rather than parsing YAML inline, so a
config-shape change only needs updating here.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

DEFAULT_CONFIG_PATH = Path(__file__).resolve().parent.parent.parent / "configs" / "dataset.yaml"


class ConfigError(ValueError):
    """Raised when dataset.yaml is missing, malformed, or internally inconsistent."""


@dataclass(frozen=True)
class SplitConfig:
    train: float
    val: float
    test: float
    group_by: tuple[str, ...]
    random_seed: int


@dataclass(frozen=True)
class QualityConfig:
    min_width_px: int
    min_height_px: int
    max_file_size_mb: float


@dataclass(frozen=True)
class DeduplicateConfig:
    exact_hash_algorithm: str
    perceptual_hash_size: int
    near_duplicate_hamming_threshold: int


@dataclass(frozen=True)
class PrivacyConfig:
    flags: tuple[str, ...]
    exclude_flagged_from_split_by_default: bool


@dataclass(frozen=True)
class LicensingConfig:
    require_recorded_license: bool
    unclear_license_treated_as: str


@dataclass(frozen=True)
class DatasetConfig:
    dataset_name: str
    schema_version: int
    classes: tuple[str, ...]
    image_domains: tuple[str, ...]
    raw_dir: Path
    interim_dir: Path
    processed_dir: Path
    manifests_dir: Path
    reports_dir: Path
    split: SplitConfig
    quality: QualityConfig
    deduplicate: DeduplicateConfig
    privacy: PrivacyConfig
    licensing: LicensingConfig


def _require(data: dict[str, Any], key: str, config_path: Path) -> Any:  # noqa: ANN401
    if key not in data:
        raise ConfigError(f"{config_path}: missing required key '{key}'")
    return data[key]


def load_dataset_config(config_path: Path = DEFAULT_CONFIG_PATH) -> DatasetConfig:
    """Loads and validates dataset.yaml. Raises ConfigError on any structural problem —
    never returns a partially-valid config, since every downstream script trusts this
    shape completely."""
    if not config_path.exists():
        raise ConfigError(f"Dataset config not found at {config_path}")

    with config_path.open("r", encoding="utf-8") as handle:
        raw = yaml.safe_load(handle)

    if not isinstance(raw, dict):
        raise ConfigError(f"{config_path}: top level must be a mapping")

    classes = tuple(_require(raw, "classes", config_path))
    if len(classes) == 0:
        raise ConfigError(f"{config_path}: 'classes' must not be empty")

    paths = _require(raw, "paths", config_path)
    config_root = config_path.resolve().parent.parent  # ml/configs/.. == ml/

    split_raw = _require(raw, "split", config_path)
    fractions = (split_raw["train"], split_raw["val"], split_raw["test"])
    total = sum(fractions)
    if abs(total - 1.0) > 1e-6:
        raise ConfigError(
            f"{config_path}: split fractions must sum to 1.0, got {total} "
            f"(train={fractions[0]}, val={fractions[1]}, test={fractions[2]})"
        )
    if any(fraction <= 0 for fraction in fractions):
        raise ConfigError(f"{config_path}: split fractions must all be positive, got {fractions}")

    split = SplitConfig(
        train=float(split_raw["train"]),
        val=float(split_raw["val"]),
        test=float(split_raw["test"]),
        group_by=tuple(split_raw["group_by"]),
        random_seed=int(split_raw["random_seed"]),
    )

    quality_raw = _require(raw, "quality", config_path)
    quality = QualityConfig(
        min_width_px=int(quality_raw["min_width_px"]),
        min_height_px=int(quality_raw["min_height_px"]),
        max_file_size_mb=float(quality_raw["max_file_size_mb"]),
    )

    dedup_raw = _require(raw, "deduplicate", config_path)
    deduplicate = DeduplicateConfig(
        exact_hash_algorithm=str(dedup_raw["exact_hash_algorithm"]),
        perceptual_hash_size=int(dedup_raw["perceptual_hash_size"]),
        near_duplicate_hamming_threshold=int(dedup_raw["near_duplicate_hamming_threshold"]),
    )

    privacy_raw = _require(raw, "privacy", config_path)
    privacy = PrivacyConfig(
        flags=tuple(privacy_raw["flags"]),
        exclude_flagged_from_split_by_default=bool(
            privacy_raw["exclude_flagged_from_split_by_default"]
        ),
    )

    licensing_raw = _require(raw, "licensing", config_path)
    licensing = LicensingConfig(
        require_recorded_license=bool(licensing_raw["require_recorded_license"]),
        unclear_license_treated_as=str(licensing_raw["unclear_license_treated_as"]),
    )

    return DatasetConfig(
        dataset_name=str(_require(raw, "dataset_name", config_path)),
        schema_version=int(_require(raw, "schema_version", config_path)),
        classes=classes,
        image_domains=tuple(_require(raw, "image_domains", config_path)),
        raw_dir=(config_root / paths["raw"]).resolve(),
        interim_dir=(config_root / paths["interim"]).resolve(),
        processed_dir=(config_root / paths["processed"]).resolve(),
        manifests_dir=(config_root / paths["manifests"]).resolve(),
        reports_dir=(config_root / paths["reports"]).resolve(),
        split=split,
        quality=quality,
        deduplicate=deduplicate,
        privacy=privacy,
        licensing=licensing,
    )
