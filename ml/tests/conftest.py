"""Shared pytest fixtures for the data-governance pipeline tests.

Every fixture that produces image bytes is built with Pillow at test time
(never checked-in binary fixture files) and is explicitly synthetic — no
real photograph appears anywhere in this test suite, matching this
block's "dummy/synthetic data must be labeled" requirement applied to test
fixtures too, not just the production dataset.
"""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml
from PIL import Image


@pytest.fixture
def tmp_ml_root(tmp_path: Path) -> Path:
    """A throwaway ml/-shaped directory tree, isolated per test — nothing in
    this suite ever reads or writes the real ml/data/ or ml/reports/."""
    (tmp_path / "configs").mkdir()
    (tmp_path / "data" / "raw").mkdir(parents=True)
    (tmp_path / "data" / "interim").mkdir(parents=True)
    (tmp_path / "data" / "processed").mkdir(parents=True)
    (tmp_path / "data" / "manifests").mkdir(parents=True)
    (tmp_path / "reports").mkdir()
    return tmp_path


@pytest.fixture
def dataset_config_path(tmp_ml_root: Path) -> Path:
    config = {
        "dataset_name": "test-dataset",
        "schema_version": 1,
        "classes": ["no_damage", "minor_damage", "major_damage", "destroyed", "unknown"],
        "image_domains": ["ground_level", "satellite_aerial"],
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
            "group_by": ["source_id", "geographic_group"],
            "random_seed": 12345,
        },
        "quality": {"min_width_px": 50, "min_height_px": 50, "max_file_size_mb": 25},
        "deduplicate": {
            "exact_hash_algorithm": "sha256",
            "perceptual_hash_size": 8,
            "near_duplicate_hamming_threshold": 4,
        },
        "privacy": {
            "flags": ["identifiable_face", "legible_identity_document", "deceased_person"],
            "exclude_flagged_from_split_by_default": True,
        },
        "licensing": {"require_recorded_license": True, "unclear_license_treated_as": "excluded"},
    }
    path = tmp_ml_root / "configs" / "dataset.yaml"
    path.write_text(yaml.safe_dump(config), encoding="utf-8")
    return path


@pytest.fixture
def sources_manifest_path(tmp_ml_root: Path) -> Path:
    content = """# Sources

## Source table

| `source_id` | Desc | License | Consent | `image_domain` | Geo | Date | By |
|---|---|---|---|---|---|---|---|
| synthetic-test | test fixture | CC0 | Public-domain / CC0 | ground_level | none | 2026 | test |
| unlicensed-source | no license | | | ground_level | none | | |

## Rejected / excluded sources

| `source_id` (proposed) | Reason | Date | By |
|---|---|---|---|
| _(none yet)_ | | | |
"""
    path = tmp_ml_root / "data" / "manifests" / "SOURCES.md"
    path.write_text(content, encoding="utf-8")
    return path


def make_solid_image(path: Path, width: int, height: int, color: tuple[int, int, int]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGB", (width, height), color).save(path, format="JPEG")


def make_checkerboard_image(path: Path, size: int, cell: int, invert: bool = False) -> None:
    """A non-flat image (unlike make_solid_image) — needed for perceptual-hash
    tests, since a flat/uniform image's aHash is degenerate (every pixel
    equals the mean, so all solid-color images of any hue hash identically)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    img = Image.new("RGB", (size, size))
    pixels = img.load()
    assert pixels is not None
    for y in range(size):
        for x in range(size):
            is_light = ((x // cell) + (y // cell)) % 2 == 0
            on = (not is_light) if invert else is_light
            value = 235 if on else 15
            pixels[x, y] = (value, value, value)
    img.save(path, format="JPEG")
