"""Checkpoint save/load for a training run's best-so-far model state, per
this block's "checkpoints" requirement — the checkpoint records the
architecture name, resolution, and class list alongside the state_dict, so
loading a checkpoint later doesn't require separately remembering (or
guessing) how it was built.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import torch
from torch import nn


@dataclass(frozen=True)
class CheckpointMetadata:
    architecture: str
    resolution_px: int
    classes: tuple[str, ...]
    epoch: int
    validation_macro_f1: float


def save_checkpoint(model: nn.Module, metadata: CheckpointMetadata, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload: dict[str, Any] = {
        "model_state_dict": model.state_dict(),
        "architecture": metadata.architecture,
        "resolution_px": metadata.resolution_px,
        "classes": list(metadata.classes),
        "epoch": metadata.epoch,
        "validation_macro_f1": metadata.validation_macro_f1,
    }
    torch.save(payload, path)


def checkpoint_size_bytes(path: Path) -> int:
    """Actual on-disk checkpoint size — the authoritative "model size"
    benchmark figure (see models.model_size_bytes's own doc comment for why
    the in-memory parameter-count estimate is a secondary, coarser proxy)."""
    return path.stat().st_size


def load_checkpoint_metadata(path: Path) -> CheckpointMetadata:
    """Loads only the metadata (not the state_dict, which requires an
    already-constructed model of the matching architecture to load into) —
    used by the benchmark report to describe a saved checkpoint without
    needing to reconstruct the model just to read its own metadata back."""
    # weights_only=False is safe here specifically because this project only
    # ever loads checkpoints it produced itself (ml/models/, never an
    # externally-sourced or user-uploaded file) — this is not a general-purpose
    # untrusted-deserialization path, unlike loading an arbitrary pickle from
    # the internet, which is what weights_only=True exists to guard against.
    payload = torch.load(path, map_location="cpu", weights_only=False)
    return CheckpointMetadata(
        architecture=str(payload["architecture"]),
        resolution_px=int(payload["resolution_px"]),
        classes=tuple(payload["classes"]),
        epoch=int(payload["epoch"]),
        validation_macro_f1=float(payload["validation_macro_f1"]),
    )
