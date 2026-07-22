from __future__ import annotations

from pathlib import Path

import pytest

from data_governance.manifest import ManifestRow, write_manifest
from training.dataset import (
    AugmentationSpec,
    EmptySplitError,
    ManifestImageDataset,
    build_transform,
    effective_label,
    load_split_rows,
)

from .conftest import make_solid_image

CLASSES = ("no_damage", "minor_damage", "major_damage", "destroyed", "unknown")


def test_effective_label_prefers_adjudicated() -> None:
    row = ManifestRow(
        image_id="a",
        source_id="s",
        relative_path="a.jpg",
        label="minor_damage",
        adjudicated_label="major_damage",
    )
    assert effective_label(row) == "major_damage"


def test_effective_label_falls_back_to_raw_label() -> None:
    row = ManifestRow(image_id="a", source_id="s", relative_path="a.jpg", label="no_damage")
    assert effective_label(row) == "no_damage"


def test_load_split_rows_partitions_by_split_column(tmp_path: Path) -> None:
    rows = [
        ManifestRow(
            image_id="a", source_id="s", relative_path="a.jpg", label="no_damage", split="train"
        ),
        ManifestRow(
            image_id="b", source_id="s", relative_path="b.jpg", label="no_damage", split="val"
        ),
        ManifestRow(
            image_id="c", source_id="s", relative_path="c.jpg", label="no_damage", split="test"
        ),
    ]
    manifest_path = tmp_path / "split.csv"
    write_manifest(rows, manifest_path)

    result = load_split_rows(manifest_path, CLASSES)
    assert len(result.train) == 1
    assert len(result.val) == 1
    assert len(result.test) == 1


def test_load_split_rows_excludes_corrupt_rows(tmp_path: Path) -> None:
    rows = [
        ManifestRow(
            image_id="a",
            source_id="s",
            relative_path="a.jpg",
            label="no_damage",
            split="train",
            is_corrupt=True,
        ),
        ManifestRow(
            image_id="b", source_id="s", relative_path="b.jpg", label="no_damage", split="train"
        ),
    ]
    manifest_path = tmp_path / "split.csv"
    write_manifest(rows, manifest_path)

    result = load_split_rows(manifest_path, CLASSES)
    assert len(result.train) == 1


def test_load_split_rows_excludes_rows_with_no_split_assignment(tmp_path: Path) -> None:
    rows = [
        ManifestRow(image_id="a", source_id="s", relative_path="a.jpg", label="no_damage", split="")
    ]
    manifest_path = tmp_path / "split.csv"
    write_manifest(rows, manifest_path)

    result = load_split_rows(manifest_path, CLASSES)
    assert len(result.train) == 0
    assert len(result.val) == 0
    assert len(result.test) == 0


def test_load_split_rows_excludes_rows_with_unrecognized_label(tmp_path: Path) -> None:
    rows = [
        ManifestRow(
            image_id="a",
            source_id="s",
            relative_path="a.jpg",
            label="not_a_real_class",
            split="train",
        )
    ]
    manifest_path = tmp_path / "split.csv"
    write_manifest(rows, manifest_path)

    result = load_split_rows(manifest_path, CLASSES)
    assert len(result.train) == 0


def test_manifest_image_dataset_rejects_empty_rows(tmp_path: Path) -> None:
    transform = build_transform(64, (0.5, 0.5, 0.5), (0.5, 0.5, 0.5), augment=False)
    with pytest.raises(EmptySplitError):
        ManifestImageDataset([], tmp_path, CLASSES, transform)


def test_manifest_image_dataset_returns_tensor_and_label_index(tmp_path: Path) -> None:
    make_solid_image(tmp_path / "s" / "a.jpg", 100, 100, (10, 20, 30))
    row = ManifestRow(image_id="s/a.jpg", source_id="s", relative_path="a.jpg", label="destroyed")
    transform = build_transform(64, (0.485, 0.456, 0.406), (0.229, 0.224, 0.225), augment=False)

    dataset = ManifestImageDataset([row], tmp_path, CLASSES, transform)
    tensor, label_index = dataset[0]

    assert tensor.shape == (3, 64, 64)
    assert label_index == CLASSES.index("destroyed")


def test_manifest_image_dataset_class_counts(tmp_path: Path) -> None:
    make_solid_image(tmp_path / "s" / "a.jpg", 50, 50, (1, 2, 3))
    make_solid_image(tmp_path / "s" / "b.jpg", 50, 50, (4, 5, 6))
    rows = [
        ManifestRow(image_id="s/a.jpg", source_id="s", relative_path="a.jpg", label="no_damage"),
        ManifestRow(image_id="s/b.jpg", source_id="s", relative_path="b.jpg", label="no_damage"),
    ]
    transform = build_transform(32, (0.5, 0.5, 0.5), (0.5, 0.5, 0.5), augment=False)
    dataset = ManifestImageDataset(rows, tmp_path, CLASSES, transform)

    assert dataset.class_counts() == {"no_damage": 2}


def test_build_transform_with_augmentation_produces_correct_shape(tmp_path: Path) -> None:
    make_solid_image(tmp_path / "s" / "a.jpg", 80, 80, (10, 10, 10))
    row = ManifestRow(image_id="s/a.jpg", source_id="s", relative_path="a.jpg", label="unknown")
    spec = AugmentationSpec(0.5, 15, 0.3, 0.3, 0.2, 0.15, 5)
    transform = build_transform(
        64, (0.485, 0.456, 0.406), (0.229, 0.224, 0.225), augment=True, augmentation_config=spec
    )

    dataset = ManifestImageDataset([row], tmp_path, CLASSES, transform)
    tensor, _ = dataset[0]
    assert tensor.shape == (3, 64, 64)
