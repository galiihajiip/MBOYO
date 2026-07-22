"""Loads the active model artifact exactly once at process startup and
holds it in memory for the lifetime of the process — "model load once" per
this block's explicit requirement, never re-loaded per-request.

Reads the exact export shape ml/src/training/export.py (BLOCK 20) produces:
`<version>.onnx` + `<version>_metadata.json` (metadata field names mirror
model_registry_entries/model_evaluations columns — see export.py's module
docstring) under `settings.model_artifact_dir`, with an `active_version.txt`
file naming which version is currently active. This file-based indirection
(rather than always loading "the newest file") is deliberate: promoting a
model is then "write one small text file," not "guess from mtime," and a
rollback is equally simple.
"""

from __future__ import annotations

import json
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import onnxruntime

CLASSES: tuple[str, ...] = ("unknown", "no_damage", "minor_damage", "major_damage", "destroyed")


class ModelNotLoadedError(RuntimeError):
    """Raised when an inference call is attempted before a model has loaded."""


@dataclass(frozen=True)
class PreprocessingSpec:
    resolution_px: int
    normalization_mean: tuple[float, float, float]
    normalization_std: tuple[float, float, float]


@dataclass(frozen=True)
class LoadedModel:
    version: str
    architecture: str
    checksum: str
    is_advisory_only: bool
    preprocessing: PreprocessingSpec
    session: onnxruntime.InferenceSession
    classes: tuple[str, ...]


class ModelRegistry:
    """Thread-safe holder for the single currently-loaded model.

    FastAPI/uvicorn may serve requests from multiple worker threads (even
    with a single process); a plain module-level variable set once at
    startup and only ever read afterward is safe without a lock for reads,
    but the lock still guards the (rare, startup-only) load path itself
    against a hypothetical concurrent reload.
    """

    def __init__(self, artifact_dir: Path) -> None:
        self._artifact_dir = artifact_dir
        self._lock = threading.Lock()
        self._loaded: LoadedModel | None = None
        self._load_error: str | None = None

    def load(self) -> None:
        with self._lock:
            try:
                self._loaded = _load_active_model(self._artifact_dir)
                self._load_error = None
            except Exception as exc:  # noqa: BLE001 - recorded, not swallowed
                self._loaded = None
                self._load_error = str(exc)

    @property
    def is_ready(self) -> bool:
        return self._loaded is not None

    @property
    def load_error(self) -> str | None:
        return self._load_error

    def require_loaded(self) -> LoadedModel:
        if self._loaded is None:
            raise ModelNotLoadedError(self._load_error or "No model artifact has been loaded")
        return self._loaded


def _load_active_model(artifact_dir: Path) -> LoadedModel:
    active_version_path = artifact_dir / "active_version.txt"
    if not active_version_path.exists():
        raise ModelNotLoadedError(f"No active_version.txt found under {artifact_dir}")

    version = active_version_path.read_text(encoding="utf-8").strip()
    if not version:
        raise ModelNotLoadedError(f"{active_version_path} is empty")

    metadata_path = artifact_dir / f"{version}_metadata.json"
    onnx_path = artifact_dir / f"{version}.onnx"
    if not metadata_path.exists():
        raise ModelNotLoadedError(f"Metadata file not found: {metadata_path}")
    if not onnx_path.exists():
        raise ModelNotLoadedError(f"ONNX artifact not found: {onnx_path}")

    metadata: dict[str, Any] = json.loads(metadata_path.read_text(encoding="utf-8"))

    onnx_checksum = str(metadata["onnx_checksum"])
    actual_checksum = _sha256_of_file(onnx_path)
    if onnx_checksum != actual_checksum:
        raise ModelNotLoadedError(
            f"Checksum mismatch for {onnx_path}: metadata says {onnx_checksum}, "
            f"actual file hashes to {actual_checksum} — refusing to load a "
            "possibly-corrupted or tampered artifact."
        )

    preprocessing_raw = metadata["preprocessing"]
    mean_values = [float(v) for v in preprocessing_raw["normalization_mean"]]
    std_values = [float(v) for v in preprocessing_raw["normalization_std"]]
    preprocessing = PreprocessingSpec(
        resolution_px=int(preprocessing_raw["resolution_px"]),
        normalization_mean=(mean_values[0], mean_values[1], mean_values[2]),
        normalization_std=(std_values[0], std_values[1], std_values[2]),
    )

    session = onnxruntime.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])

    classes = tuple(metadata["classes"]) if "classes" in metadata else CLASSES

    return LoadedModel(
        version=version,
        architecture=str(metadata["architecture"]),
        checksum=onnx_checksum,
        is_advisory_only=bool(metadata["is_advisory_only"]),
        preprocessing=preprocessing,
        session=session,
        classes=classes,
    )


def _sha256_of_file(path: Path) -> str:
    import hashlib

    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


PREPROCESSING_VERSION = "v1"


def run_inference(model: LoadedModel, image: np.ndarray) -> np.ndarray:
    """Runs one forward pass, returning raw logits (n_classes,) — softmax
    and calibration are applied by the caller (app/inference.py), since
    those steps also need access to a fitted temperature, which is a
    property of the whole predict pipeline, not of the ONNX session
    itself."""
    input_name = model.session.get_inputs()[0].name
    outputs = model.session.run(None, {input_name: image})
    logits: np.ndarray = outputs[0][0]
    return logits
