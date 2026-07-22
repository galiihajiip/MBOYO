from __future__ import annotations

from pathlib import Path

import pytest

from data_governance.config import ConfigError, load_dataset_config


def test_loads_valid_config(dataset_config_path: Path) -> None:
    config = load_dataset_config(dataset_config_path)
    assert config.dataset_name == "test-dataset"
    assert config.classes == ("no_damage", "minor_damage", "major_damage", "destroyed", "unknown")
    assert config.split.train == pytest.approx(0.7)


def test_missing_file_raises_config_error(tmp_path: Path) -> None:
    with pytest.raises(ConfigError):
        load_dataset_config(tmp_path / "does-not-exist.yaml")


def test_split_fractions_must_sum_to_one(tmp_path: Path) -> None:
    import yaml

    config = {
        "dataset_name": "bad",
        "schema_version": 1,
        "classes": ["no_damage"],
        "image_domains": ["ground_level"],
        "paths": {
            "raw": "data/raw",
            "interim": "data/interim",
            "processed": "data/processed",
            "manifests": "data/manifests",
            "reports": "reports",
        },
        "split": {
            "train": 0.5,
            "val": 0.3,
            "test": 0.3,
            "group_by": ["source_id"],
            "random_seed": 1,
        },
        "quality": {"min_width_px": 1, "min_height_px": 1, "max_file_size_mb": 1},
        "deduplicate": {
            "exact_hash_algorithm": "sha256",
            "perceptual_hash_size": 8,
            "near_duplicate_hamming_threshold": 4,
        },
        "privacy": {"flags": [], "exclude_flagged_from_split_by_default": True},
        "licensing": {"require_recorded_license": True, "unclear_license_treated_as": "excluded"},
    }
    path = tmp_path / "dataset.yaml"
    path.write_text(yaml.safe_dump(config), encoding="utf-8")

    with pytest.raises(ConfigError, match="sum to 1.0"):
        load_dataset_config(path)


def test_empty_classes_list_raises_config_error(tmp_path: Path) -> None:
    import yaml

    config = {
        "dataset_name": "bad",
        "schema_version": 1,
        "classes": [],
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
        "quality": {"min_width_px": 1, "min_height_px": 1, "max_file_size_mb": 1},
        "deduplicate": {
            "exact_hash_algorithm": "sha256",
            "perceptual_hash_size": 8,
            "near_duplicate_hamming_threshold": 4,
        },
        "privacy": {"flags": [], "exclude_flagged_from_split_by_default": True},
        "licensing": {"require_recorded_license": True, "unclear_license_treated_as": "excluded"},
    }
    path = tmp_path / "dataset.yaml"
    path.write_text(yaml.safe_dump(config), encoding="utf-8")

    with pytest.raises(ConfigError, match="must not be empty"):
        load_dataset_config(path)
