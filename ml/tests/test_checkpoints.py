from __future__ import annotations

from pathlib import Path

from torch import nn

from training.checkpoints import (
    CheckpointMetadata,
    checkpoint_size_bytes,
    load_checkpoint_metadata,
    save_checkpoint,
)


def test_save_and_load_checkpoint_metadata_round_trips(tmp_path: Path) -> None:
    model = nn.Linear(10, 5)
    metadata = CheckpointMetadata(
        architecture="mobilenet_v3_large",
        resolution_px=224,
        classes=("no_damage", "minor_damage", "major_damage", "destroyed", "unknown"),
        epoch=3,
        validation_macro_f1=0.75,
    )
    path = tmp_path / "checkpoint.pt"

    save_checkpoint(model, metadata, path)
    loaded = load_checkpoint_metadata(path)

    assert loaded.architecture == metadata.architecture
    assert loaded.resolution_px == metadata.resolution_px
    assert loaded.classes == metadata.classes
    assert loaded.epoch == metadata.epoch
    assert loaded.validation_macro_f1 == metadata.validation_macro_f1


def test_checkpoint_size_bytes_matches_actual_file_size(tmp_path: Path) -> None:
    model = nn.Linear(10, 5)
    metadata = CheckpointMetadata(
        architecture="mobilenet_v3_large",
        resolution_px=224,
        classes=("no_damage",),
        epoch=0,
        validation_macro_f1=0.5,
    )
    path = tmp_path / "checkpoint.pt"
    save_checkpoint(model, metadata, path)

    assert checkpoint_size_bytes(path) == path.stat().st_size
    assert checkpoint_size_bytes(path) > 0


def test_save_checkpoint_creates_parent_directories(tmp_path: Path) -> None:
    model = nn.Linear(2, 2)
    metadata = CheckpointMetadata(
        architecture="convnext_tiny",
        resolution_px=224,
        classes=("a", "b"),
        epoch=0,
        validation_macro_f1=0.1,
    )
    path = tmp_path / "nested" / "dir" / "checkpoint.pt"

    save_checkpoint(model, metadata, path)
    assert path.exists()
