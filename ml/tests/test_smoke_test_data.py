from __future__ import annotations

from pathlib import Path

from training.smoke_test_data import generate_smoke_test_dataset

CLASSES = ("no_damage", "minor_damage", "major_damage", "destroyed", "unknown")


def test_generates_images_per_class(tmp_path: Path) -> None:
    rows = generate_smoke_test_dataset(tmp_path, CLASSES, images_per_class=6, image_size_px=32)
    assert len(rows) == len(CLASSES) * 6


def test_every_row_is_marked_synthetic(tmp_path: Path) -> None:
    rows = generate_smoke_test_dataset(tmp_path, CLASSES, images_per_class=4, image_size_px=32)
    assert all(row.is_synthetic for row in rows)


def test_images_are_actually_written_to_disk(tmp_path: Path) -> None:
    rows = generate_smoke_test_dataset(tmp_path, CLASSES, images_per_class=2, image_size_px=32)
    for row in rows:
        path = tmp_path / row.source_id / row.relative_path
        assert path.exists()


def test_split_assignment_covers_all_three_splits_with_enough_images(tmp_path: Path) -> None:
    rows = generate_smoke_test_dataset(tmp_path, CLASSES, images_per_class=6, image_size_px=32)
    splits_present = {row.split for row in rows}
    assert splits_present == {"train", "val", "test"}


def test_every_row_has_the_requested_dimensions_recorded(tmp_path: Path) -> None:
    rows = generate_smoke_test_dataset(tmp_path, CLASSES, images_per_class=2, image_size_px=48)
    assert all(row.width_px == 48 and row.height_px == 48 for row in rows)


def test_all_rows_share_the_same_source_id(tmp_path: Path) -> None:
    rows = generate_smoke_test_dataset(tmp_path, CLASSES, images_per_class=2, image_size_px=32)
    assert len({row.source_id for row in rows}) == 1
