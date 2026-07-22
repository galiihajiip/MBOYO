"""Generates a tiny, fully SYNTHETIC image dataset (never real photographs)
for the CPU smoke-test mode — proves the full train/validate/checkpoint/
early-stop/benchmark pipeline runs correctly end to end without requiring
real training data or meaningful wall-clock time.

Every row this module produces has is_synthetic=True in its ManifestRow,
and every report/log that consumes smoke-test output must carry that flag
through (see benchmark.py's BenchmarkResult.is_smoke_test) — per this
block's carried-over "dummy/synthetic data must be labeled" requirement
from BLOCK 18, applied here to training/benchmark artifacts specifically,
not just dataset manifests.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

from data_governance.manifest import ManifestRow

# Deterministic, distinguishable per-class colors — not meant to be
# learnable in any meaningful sense (this is a smoke test of the PIPELINE,
# not a claim that a model can learn anything from solid-color synthetic
# images); a handful of images per class is enough to exercise every code
# path (batching, class-weighted loss, metrics with all classes present,
# checkpointing, early stopping) without asserting the resulting numbers
# mean anything about real-world model quality.
_CLASS_COLORS: dict[str, tuple[int, int, int]] = {
    "no_damage": (34, 139, 34),
    "minor_damage": (218, 165, 32),
    "major_damage": (255, 140, 0),
    "destroyed": (178, 34, 34),
    "unknown": (128, 128, 128),
}


def generate_smoke_test_dataset(
    output_dir: Path,
    classes: tuple[str, ...],
    images_per_class: int,
    image_size_px: int,
) -> list[ManifestRow]:
    """Writes images to output_dir/smoke-test-synthetic/<class>_<i>.jpg and
    returns their ManifestRow entries, pre-split (roughly 60/20/20
    train/val/test, at least one image per split per class where
    images_per_class allows) — every row has source_id="smoke-test-synthetic"
    and is_synthetic=True."""
    source_id = "smoke-test-synthetic"
    source_dir = output_dir / source_id
    source_dir.mkdir(parents=True, exist_ok=True)

    rows: list[ManifestRow] = []
    for class_name in classes:
        color = _CLASS_COLORS.get(class_name, (100, 100, 100))
        for i in range(images_per_class):
            filename = f"{class_name}_{i}.jpg"
            path = source_dir / filename
            # A checkerboard (not a flat solid) — a flat image is degenerate
            # for anything perceptual-hash-like, per the same reasoning
            # BLOCK 18's perceptual-hash tests already established; not
            # strictly required for classification, but keeps this
            # generator reusable if a future smoke test also exercises
            # BLOCK 18's dedup pipeline on the same synthetic images.
            image = Image.new("RGB", (image_size_px, image_size_px), color)
            pixels = image.load()
            assert pixels is not None
            cell = max(1, image_size_px // 8)
            for y in range(image_size_px):
                for x in range(image_size_px):
                    if ((x // cell) + (y // cell)) % 2 == 0:
                        lighter = (
                            min(255, color[0] + 40),
                            min(255, color[1] + 40),
                            min(255, color[2] + 40),
                        )
                        pixels[x, y] = lighter
            image.save(path, format="JPEG")

            split = (
                "train"
                if i < images_per_class * 0.6
                else ("val" if i < images_per_class * 0.8 else "test")
            )
            rows.append(
                ManifestRow(
                    image_id=f"{source_id}/{filename}",
                    source_id=source_id,
                    relative_path=filename,
                    width_px=image_size_px,
                    height_px=image_size_px,
                    image_domain="ground_level",
                    is_synthetic=True,
                    label=class_name,
                    split=split,
                )
            )

    return rows
