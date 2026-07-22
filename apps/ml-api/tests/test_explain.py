from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

from app.explain import GRID_SIZE, compute_occlusion_sensitivity
from app.heatmap import render_heatmap_overlay_png_base64
from app.model_registry import ModelRegistry

from .test_model_registry import _write_valid_artifact


def test_compute_occlusion_sensitivity_returns_grid_shaped_map(tmp_path: Path) -> None:
    _write_valid_artifact(tmp_path)
    registry = ModelRegistry(tmp_path)
    registry.load()
    model = registry.require_loaded()

    input_tensor = np.random.default_rng(0).normal(size=(1, 3, 4, 4)).astype(np.float32)
    sensitivity_map = compute_occlusion_sensitivity(model, input_tensor)

    assert sensitivity_map.grid.shape == (GRID_SIZE, GRID_SIZE)
    assert sensitivity_map.grid.min() >= 0.0
    assert sensitivity_map.grid.max() <= 1.0 + 1e-6


def test_compute_occlusion_sensitivity_respects_explicit_target_class(tmp_path: Path) -> None:
    _write_valid_artifact(tmp_path)
    registry = ModelRegistry(tmp_path)
    registry.load()
    model = registry.require_loaded()

    input_tensor = np.random.default_rng(1).normal(size=(1, 3, 4, 4)).astype(np.float32)
    sensitivity_map = compute_occlusion_sensitivity(model, input_tensor, target_class_index=2)
    assert sensitivity_map.target_class_index == 2


def test_render_heatmap_overlay_returns_valid_base64_png(tmp_path: Path) -> None:
    _write_valid_artifact(tmp_path)
    registry = ModelRegistry(tmp_path)
    registry.load()
    model = registry.require_loaded()

    input_tensor = np.random.default_rng(2).normal(size=(1, 3, 4, 4)).astype(np.float32)
    sensitivity_map = compute_occlusion_sensitivity(model, input_tensor)

    original_image = Image.new("RGB", (64, 64), (100, 100, 100))
    encoded = render_heatmap_overlay_png_base64(original_image, sensitivity_map)

    import base64
    import io

    decoded_bytes = base64.b64decode(encoded)
    decoded_image = Image.open(io.BytesIO(decoded_bytes))
    assert decoded_image.format == "PNG"
    assert decoded_image.size == (64, 64)
