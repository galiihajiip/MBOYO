from __future__ import annotations

from pathlib import Path

from torch import nn

from training.export import (
    ExportManifest,
    PreprocessingSpec,
    RuntimeBenchmarkResult,
    benchmark_onnx_runtime_latency,
    compute_sha256_checksum,
    export_onnx,
    export_torchscript,
    write_export_manifest,
)


class _TinyModel(nn.Module):
    def __init__(self, num_classes: int = 3) -> None:
        super().__init__()
        self.features = nn.Sequential(nn.Conv2d(3, 4, kernel_size=3, padding=1), nn.ReLU())
        self.pool = nn.AdaptiveAvgPool2d(1)
        self.classifier = nn.Sequential(nn.Flatten(), nn.Linear(4, num_classes))

    def forward(self, x):  # type: ignore[no-untyped-def]
        return self.classifier(self.pool(self.features(x)))


def test_export_onnx_produces_a_checked_artifact(tmp_path: Path) -> None:
    model = _TinyModel()
    model.eval()
    artifact = export_onnx(model, resolution_px=32, output_path=tmp_path / "model.onnx")
    assert artifact.path.exists()
    assert artifact.size_bytes > 0
    assert len(artifact.sha256_checksum) == 64


def test_export_torchscript_produces_a_loadable_artifact(tmp_path: Path) -> None:
    model = _TinyModel()
    model.eval()
    artifact = export_torchscript(model, resolution_px=32, output_path=tmp_path / "model.pt")
    assert artifact.path.exists()
    assert artifact.size_bytes > 0

    import torch

    loaded = torch.jit.load(str(artifact.path))  # type: ignore[no-untyped-call]
    output = loaded(torch.randn(1, 3, 32, 32))
    assert output.shape == (1, 3)


def test_compute_sha256_checksum_is_deterministic(tmp_path: Path) -> None:
    path = tmp_path / "file.bin"
    path.write_bytes(b"some deterministic content")
    checksum_a = compute_sha256_checksum(path)
    checksum_b = compute_sha256_checksum(path)
    assert checksum_a == checksum_b
    assert len(checksum_a) == 64


def test_compute_sha256_checksum_differs_for_different_content(tmp_path: Path) -> None:
    path_a = tmp_path / "a.bin"
    path_b = tmp_path / "b.bin"
    path_a.write_bytes(b"content a")
    path_b.write_bytes(b"content b")
    assert compute_sha256_checksum(path_a) != compute_sha256_checksum(path_b)


def test_benchmark_onnx_runtime_latency_returns_percentiles(tmp_path: Path) -> None:
    model = _TinyModel()
    model.eval()
    onnx_artifact = export_onnx(model, resolution_px=32, output_path=tmp_path / "model.onnx")

    result = benchmark_onnx_runtime_latency(
        onnx_artifact.path, resolution_px=32, num_warmup_runs=2, num_measured_runs=5
    )
    assert result.sample_count == 5
    assert result.p50_ms <= result.p95_ms <= result.p99_ms
    assert result.mean_ms > 0


def test_write_export_manifest_round_trips_via_json(tmp_path: Path) -> None:
    manifest = ExportManifest(
        version="v1",
        architecture="mobilenet_v3_large",
        artifact_path="model.onnx",
        torchscript_path="model.pt",
        trained_at="2026-07-19T00:00:00Z",
        dataset_identity="test-dataset",
        macro_f1=0.8,
        destroyed_recall=0.7,
        calibration_error=0.05,
        evaluated_at="2026-07-19T00:00:00Z",
        report_path="ml/reports/eval.md",
        classes=("a", "b"),
        onnx_checksum="abc",
        torchscript_checksum="def",
        preprocessing=PreprocessingSpec(224, (0.485, 0.456, 0.406), (0.229, 0.224, 0.225)),
        runtime_benchmark=RuntimeBenchmarkResult(1.0, 2.0, 3.0, 1.5, 30),
        is_advisory_only=False,
    )
    output_path = write_export_manifest(manifest, tmp_path / "metadata.json")

    import json

    payload = json.loads(output_path.read_text(encoding="utf-8"))
    assert payload["version"] == "v1"
    assert payload["macro_f1"] == 0.8
    assert payload["destroyed_recall"] == 0.7
    assert payload["classes"] == ["a", "b"]
    assert payload["preprocessing"]["resolution_px"] == 224
    assert payload["runtime_benchmark"]["p50_ms"] == 1.0
    assert payload["is_advisory_only"] is False


def test_write_export_manifest_with_none_destroyed_recall(tmp_path: Path) -> None:
    manifest = ExportManifest(
        version="v1",
        architecture="mobilenet_v3_large",
        artifact_path="model.onnx",
        torchscript_path="model.pt",
        trained_at="2026-07-19T00:00:00Z",
        dataset_identity="test-dataset",
        macro_f1=0.8,
        destroyed_recall=None,
        calibration_error=0.05,
        evaluated_at="2026-07-19T00:00:00Z",
        report_path="ml/reports/eval.md",
        classes=("a", "b"),
        onnx_checksum="abc",
        torchscript_checksum="def",
        preprocessing=PreprocessingSpec(224, (0.485, 0.456, 0.406), (0.229, 0.224, 0.225)),
        runtime_benchmark=RuntimeBenchmarkResult(1.0, 2.0, 3.0, 1.5, 30),
        is_advisory_only=True,
    )
    output_path = write_export_manifest(manifest, tmp_path / "metadata.json")

    import json

    payload = json.loads(output_path.read_text(encoding="utf-8"))
    assert payload["destroyed_recall"] is None
    assert payload["is_advisory_only"] is True
