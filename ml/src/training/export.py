"""Exports a trained model for serving: ONNX (the format apps/ml-api's
"ONNX Runtime" inference path per ADR 0004 / SUCCESS_METRICS.md's CPU p95
latency metric expects), TorchScript (a PyTorch-native fallback/comparison
artifact), a metadata JSON, a preprocessing spec JSON, a SHA-256 checksum
of each artifact, and a runtime latency benchmark of the exported ONNX
artifact via ONNX Runtime itself (not the raw nn.Module — this measures
the actual serving path, not a proxy for it).

The metadata JSON's field names deliberately mirror
supabase/migrations/20260716153709_core_schema.sql's `model_registry_entries`
/ `model_evaluations` columns exactly (`version`, `artifact_path`,
`trained_at`, `dataset_identity`, `macro_f1`, `destroyed_recall`,
`calibration_error`, `evaluated_at`, `report_path`) so a future block
wiring this into that table has no field-name translation to invent —
this is a deliberate, load-bearing naming choice, not a coincidence.

Uses the legacy (non-dynamo) torch.onnx exporter path explicitly
(`dynamo=False`) — the newer torch.export-based exporter (PyTorch's new
default as of 2.9) requires the `onnxscript` package, which is not a
listed ml/ dependency; the legacy path is deprecated but fully functional
in the installed torch version, verified directly in this environment.
This is disclosed here rather than silently worked around, since a future
PyTorch upgrade may remove the legacy path entirely.
"""

from __future__ import annotations

import hashlib
import json
import time
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np
import onnx
import onnxruntime
import torch
from torch import nn


class ExportError(RuntimeError):
    """Raised when an export step (ONNX, TorchScript, or checksum) fails."""


@dataclass(frozen=True)
class PreprocessingSpec:
    """Exactly the preprocessing dataset.py's build_transform applies at
    evaluation time (resize + ImageNet normalization, no augmentation) —
    a serving system must replicate this exactly, so it is serialized
    alongside the model rather than left to be re-derived from source."""

    resolution_px: int
    normalization_mean: tuple[float, float, float]
    normalization_std: tuple[float, float, float]
    color_mode: str = "RGB"
    resize_method: str = "bilinear"


@dataclass(frozen=True)
class ExportedArtifact:
    path: Path
    sha256_checksum: str
    size_bytes: int


@dataclass(frozen=True)
class RuntimeBenchmarkResult:
    p50_ms: float
    p95_ms: float
    p99_ms: float
    mean_ms: float
    sample_count: int


@dataclass(frozen=True)
class ExportManifest:
    version: str
    architecture: str
    artifact_path: str
    torchscript_path: str
    trained_at: str
    dataset_identity: str
    macro_f1: float
    destroyed_recall: float | None
    calibration_error: float
    evaluated_at: str
    report_path: str
    classes: tuple[str, ...]
    onnx_checksum: str
    torchscript_checksum: str
    preprocessing: PreprocessingSpec
    runtime_benchmark: RuntimeBenchmarkResult
    is_advisory_only: bool


def compute_sha256_checksum(path: Path) -> str:
    """Streams the file in chunks rather than reading it fully into memory —
    exported model artifacts can be tens of megabytes."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def export_onnx(model: nn.Module, resolution_px: int, output_path: Path) -> ExportedArtifact:
    """Exports `model` (already in eval mode, on CPU) to ONNX at
    `output_path`, verifies the exported graph via onnx.checker, and
    returns its checksum/size. Uses a dynamic batch axis so the exported
    artifact is not hard-locked to a single input resolution/batch size."""
    model.eval()
    example_input = torch.randn(1, 3, resolution_px, resolution_px)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        torch.onnx.export(
            model,
            (example_input,),
            str(output_path),
            input_names=["input"],
            output_names=["logits"],
            opset_version=17,
            dynamic_axes={"input": {0: "batch"}, "logits": {0: "batch"}},
            dynamo=False,
        )
    except Exception as exc:  # pragma: no cover - exercised via real export tests
        raise ExportError(f"ONNX export failed: {exc}") from exc

    onnx_model = onnx.load(str(output_path))
    onnx.checker.check_model(onnx_model)

    return ExportedArtifact(
        path=output_path,
        sha256_checksum=compute_sha256_checksum(output_path),
        size_bytes=output_path.stat().st_size,
    )


def export_torchscript(model: nn.Module, resolution_px: int, output_path: Path) -> ExportedArtifact:
    """Exports `model` via `torch.jit.trace` — tracing (not scripting) is
    sufficient here since all three benchmark architectures (models.py) are
    plain feed-forward CNNs with no data-dependent control flow the trace
    could miss."""
    model.eval()
    example_input = torch.randn(1, 3, resolution_px, resolution_px)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        scripted = torch.jit.trace(model, example_input)  # type: ignore[no-untyped-call]
        scripted.save(str(output_path))
    except Exception as exc:  # pragma: no cover - exercised via real export tests
        raise ExportError(f"TorchScript export failed: {exc}") from exc

    return ExportedArtifact(
        path=output_path,
        sha256_checksum=compute_sha256_checksum(output_path),
        size_bytes=output_path.stat().st_size,
    )


def benchmark_onnx_runtime_latency(
    onnx_path: Path,
    resolution_px: int,
    num_warmup_runs: int = 5,
    num_measured_runs: int = 30,
) -> RuntimeBenchmarkResult:
    """Measures the ACTUAL serving path's latency (ONNX Runtime CPU
    execution provider on the exported .onnx artifact), not the raw
    nn.Module (see latency.py, which measures the PyTorch model directly
    for benchmark-selection purposes) — this is the number that matters for
    SUCCESS_METRICS.md's deployed CPU p95 latency metric."""
    session = onnxruntime.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name
    example_input = np.random.randn(1, 3, resolution_px, resolution_px).astype(np.float32)

    for _ in range(num_warmup_runs):
        session.run(None, {input_name: example_input})

    durations_ms = []
    for _ in range(num_measured_runs):
        start = time.perf_counter()
        session.run(None, {input_name: example_input})
        durations_ms.append((time.perf_counter() - start) * 1000)

    durations_array = np.array(durations_ms)
    return RuntimeBenchmarkResult(
        p50_ms=float(np.percentile(durations_array, 50)),
        p95_ms=float(np.percentile(durations_array, 95)),
        p99_ms=float(np.percentile(durations_array, 99)),
        mean_ms=float(np.mean(durations_array)),
        sample_count=num_measured_runs,
    )


def write_export_manifest(manifest: ExportManifest, output_path: Path) -> Path:
    """Serializes `manifest` to JSON — nested dataclasses (PreprocessingSpec,
    RuntimeBenchmarkResult) are flattened via `dataclasses.asdict`, and
    `classes`/tuples become JSON arrays."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    payload = asdict(manifest)
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)
    return output_path
