from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
import onnx
import onnxruntime
import pytest
from onnx import TensorProto, helper

from app.model_registry import ModelNotLoadedError, ModelRegistry


def _write_trivial_onnx_model(path: Path, num_classes: int = 5) -> None:
    """A tiny valid ONNX graph (input -> identity-ish linear layer) — real
    enough for onnxruntime.InferenceSession to load and run, without
    depending on ml/'s torch/torchvision model-building code (apps/ml-api
    never imports ml/ directly, per AGENTS.md's architecture boundary)."""
    input_tensor = helper.make_tensor_value_info("input", TensorProto.FLOAT, [1, 3, 4, 4])
    output_tensor = helper.make_tensor_value_info("logits", TensorProto.FLOAT, [1, num_classes])

    weight = np.random.default_rng(0).normal(size=(3 * 4 * 4, num_classes)).astype(np.float32)
    weight_initializer = helper.make_tensor(
        "weight", TensorProto.FLOAT, weight.shape, weight.flatten().tolist()
    )

    reshape_shape = helper.make_tensor("reshape_shape", TensorProto.INT64, [2], [1, 3 * 4 * 4])

    reshape_node = helper.make_node("Reshape", ["input", "reshape_shape"], ["flattened"])
    matmul_node = helper.make_node("MatMul", ["flattened", "weight"], ["logits"])

    graph = helper.make_graph(
        [reshape_node, matmul_node],
        "trivial",
        [input_tensor],
        [output_tensor],
        initializer=[weight_initializer, reshape_shape],
    )
    model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 17)])
    onnx.save(model, str(path))


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _write_valid_artifact(tmp_path: Path, version: str = "v1") -> None:
    onnx_path = tmp_path / f"{version}.onnx"
    _write_trivial_onnx_model(onnx_path)

    metadata = {
        "architecture": "trivial-test-model",
        "is_advisory_only": False,
        "classes": ["unknown", "no_damage", "minor_damage", "major_damage", "destroyed"],
        "onnx_checksum": _sha256(onnx_path),
        "preprocessing": {
            "resolution_px": 4,
            "normalization_mean": [0.485, 0.456, 0.406],
            "normalization_std": [0.229, 0.224, 0.225],
        },
    }
    (tmp_path / f"{version}_metadata.json").write_text(json.dumps(metadata), encoding="utf-8")
    (tmp_path / "active_version.txt").write_text(version, encoding="utf-8")


def test_registry_not_ready_before_load() -> None:
    registry = ModelRegistry(Path("/nonexistent"))
    assert not registry.is_ready


def test_registry_load_fails_gracefully_when_active_version_missing(tmp_path: Path) -> None:
    registry = ModelRegistry(tmp_path)
    registry.load()
    assert not registry.is_ready
    assert registry.load_error is not None
    assert "active_version.txt" in registry.load_error


def test_registry_require_loaded_raises_when_not_ready(tmp_path: Path) -> None:
    registry = ModelRegistry(tmp_path)
    registry.load()
    with pytest.raises(ModelNotLoadedError):
        registry.require_loaded()


def test_registry_loads_a_valid_artifact(tmp_path: Path) -> None:
    _write_valid_artifact(tmp_path)
    registry = ModelRegistry(tmp_path)
    registry.load()

    assert registry.is_ready
    loaded = registry.require_loaded()
    assert loaded.version == "v1"
    assert loaded.architecture == "trivial-test-model"
    assert loaded.is_advisory_only is False
    assert loaded.preprocessing.resolution_px == 4
    assert isinstance(loaded.session, onnxruntime.InferenceSession)


def test_registry_rejects_a_checksum_mismatch(tmp_path: Path) -> None:
    _write_valid_artifact(tmp_path)
    metadata_path = tmp_path / "v1_metadata.json"
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    metadata["onnx_checksum"] = "0" * 64
    metadata_path.write_text(json.dumps(metadata), encoding="utf-8")

    registry = ModelRegistry(tmp_path)
    registry.load()

    assert not registry.is_ready
    assert registry.load_error is not None
    assert "Checksum mismatch" in registry.load_error


def test_run_inference_produces_expected_output_shape(tmp_path: Path) -> None:
    _write_valid_artifact(tmp_path)
    registry = ModelRegistry(tmp_path)
    registry.load()
    loaded = registry.require_loaded()

    from app.model_registry import run_inference

    input_tensor = np.zeros((1, 3, 4, 4), dtype=np.float32)
    logits = run_inference(loaded, input_tensor)
    assert logits.shape == (5,)
