"""PyTorch Dataset reading BLOCK 18's split.csv manifest — the bridge between
the data-governance pipeline (ml/src/data_governance/, ml/src/prepare_data.py
etc.) and this block's training/benchmark code. Never re-implements
manifest parsing, image validation, or hashing — all of that is BLOCK 18's
job; this module only turns already-validated, already-split manifest rows
into (image tensor, label index) pairs.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import torch
from PIL import Image
from torch.utils.data import Dataset
from torchvision import transforms

from data_governance.manifest import ManifestRow, read_manifest


class EmptySplitError(ValueError):
    """Raised when a requested split ("train"/"val"/"test") has zero eligible rows."""


def effective_label(row: ManifestRow) -> str:
    """Adjudicated label wins over the raw label — matches audit.py's own
    class_distribution convention (BLOCK 18) exactly, so a row's "true" label
    is computed identically everywhere it matters, not just at audit time."""
    return row.adjudicated_label or row.label


@dataclass(frozen=True)
class SplitRows:
    train: list[ManifestRow]
    val: list[ManifestRow]
    test: list[ManifestRow]


def load_split_rows(manifest_path: Path, classes: tuple[str, ...]) -> SplitRows:
    """Reads the manifest and partitions by its `split` column, keeping only
    rows that are non-corrupt, have a split assignment, and have an
    effective_label present in `classes` — a row missing any of these isn't
    silently included with an empty/garbage label, it's excluded, since a
    label-less row would corrupt every metric computed downstream."""
    rows = read_manifest(manifest_path)

    train, val, test = [], [], []
    for row in rows:
        if row.is_corrupt or not row.split:
            continue
        label = effective_label(row)
        if label not in classes:
            continue

        if row.split == "train":
            train.append(row)
        elif row.split == "val":
            val.append(row)
        elif row.split == "test":
            test.append(row)

    return SplitRows(train=train, val=val, test=test)


@dataclass(frozen=True)
class AugmentationSpec:
    """Plain-value mirror of training.config.AugmentationConfig — kept
    separate so this module doesn't import training.config (avoiding a
    circular import risk, since config.py may in the future want dataset
    types) and so tests can construct one without building a full
    TrainingConfig."""

    horizontal_flip_probability: float
    rotation_degrees: float
    color_jitter_brightness: float
    color_jitter_contrast: float
    color_jitter_saturation: float
    gaussian_blur_probability: float
    gaussian_blur_kernel_size: int


def build_transform(
    resolution_px: int,
    mean: tuple[float, float, float],
    std: tuple[float, float, float],
    augment: bool,
    augmentation_config: AugmentationSpec | None = None,
) -> transforms.Compose:
    """Builds the image preprocessing pipeline. augment=True adds the
    realistic-degradation augmentations (BLOCK 19's own config) for
    training; augment=False (validation/test) applies only resize +
    ImageNet normalization, since evaluation must reflect the model's
    real-world input distribution, not an augmented one — augmenting eval
    data would make metrics unrepresentative of actual inference-time
    performance."""
    steps: list[object] = [transforms.Resize((resolution_px, resolution_px))]

    if augment and augmentation_config is not None:
        steps.append(
            transforms.RandomHorizontalFlip(p=augmentation_config.horizontal_flip_probability)
        )
        steps.append(transforms.RandomRotation(degrees=augmentation_config.rotation_degrees))
        steps.append(
            transforms.ColorJitter(
                brightness=augmentation_config.color_jitter_brightness,
                contrast=augmentation_config.color_jitter_contrast,
                saturation=augmentation_config.color_jitter_saturation,
            )
        )
        if augmentation_config.gaussian_blur_probability > 0:
            steps.append(
                transforms.RandomApply(
                    [
                        transforms.GaussianBlur(
                            kernel_size=augmentation_config.gaussian_blur_kernel_size
                        )
                    ],
                    p=augmentation_config.gaussian_blur_probability,
                )
            )

    steps.append(transforms.ToTensor())
    steps.append(transforms.Normalize(mean=list(mean), std=list(std)))
    return transforms.Compose(steps)


class ManifestImageDataset(Dataset[tuple[torch.Tensor, int]]):
    """One dataset instance per split (train/val/test) — never mixes rows
    from different splits, since that's exactly the leakage BLOCK 18's
    group-aware split.py was built to prevent."""

    def __init__(
        self,
        rows: list[ManifestRow],
        raw_dir: Path,
        classes: tuple[str, ...],
        transform: transforms.Compose,
    ) -> None:
        if len(rows) == 0:
            raise EmptySplitError("Cannot construct a dataset from zero rows")
        self._rows = rows
        self._raw_dir = raw_dir
        self._class_to_index = {name: i for i, name in enumerate(classes)}
        self._transform = transform

    def __len__(self) -> int:
        return len(self._rows)

    def __getitem__(self, index: int) -> tuple[torch.Tensor, int]:
        row = self._rows[index]
        image_path = self._raw_dir / row.source_id / row.relative_path
        with Image.open(image_path) as img:
            image = img.convert("RGB")
            tensor = self._transform(image)
        label_index = self._class_to_index[effective_label(row)]
        return tensor, label_index

    def class_counts(self) -> dict[str, int]:
        counts: dict[str, int] = {}
        for row in self._rows:
            label = effective_label(row)
            counts[label] = counts.get(label, 0) + 1
        return counts
