from __future__ import annotations

import base64
import io

import numpy as np
from PIL import Image

from app.explain import SensitivityMap
from app.heatmap import _heat_color, _upsample_grid_to_image_size, render_heatmap_overlay_png_base64


def test_upsample_grid_to_image_size_produces_the_requested_resolution() -> None:
    grid = np.array([[0.0, 1.0], [1.0, 0.0]], dtype=np.float32)
    upsampled = _upsample_grid_to_image_size(grid, width=64, height=32)
    assert upsampled.shape == (32, 64)
    assert upsampled.min() >= 0.0
    assert upsampled.max() <= 1.0


def test_upsample_grid_preserves_blocky_nearest_neighbor_quadrants() -> None:
    # A 2x2 grid upsampled to 4x4 should preserve four distinct blocky
    # quadrants (nearest-neighbor, not smoothed/interpolated).
    grid = np.array([[0.0, 1.0], [1.0, 0.0]], dtype=np.float32)
    upsampled = _upsample_grid_to_image_size(grid, width=4, height=4)
    assert upsampled[0, 0] < 0.5  # top-left quadrant ~ 0.0
    assert upsampled[0, 3] > 0.5  # top-right quadrant ~ 1.0
    assert upsampled[3, 0] > 0.5  # bottom-left quadrant ~ 1.0
    assert upsampled[3, 3] < 0.5  # bottom-right quadrant ~ 0.0


def test_heat_color_at_zero_is_pure_blue() -> None:
    assert _heat_color(0.0) == (0, 0, 255)


def test_heat_color_at_midpoint_is_pure_yellow() -> None:
    assert _heat_color(0.5) == (255, 255, 0)


def test_heat_color_at_one_is_pure_red() -> None:
    assert _heat_color(1.0) == (255, 0, 0)


def test_heat_color_clamps_values_outside_the_unit_range() -> None:
    assert _heat_color(-5.0) == _heat_color(0.0)
    assert _heat_color(5.0) == _heat_color(1.0)


def test_render_heatmap_overlay_returns_a_valid_base64_png_matching_input_size() -> None:
    grid = np.random.default_rng(0).uniform(size=(8, 8)).astype(np.float32)
    sensitivity_map = SensitivityMap(grid=grid, target_class_index=1)
    original_image = Image.new("RGB", (48, 32), (120, 130, 140))

    encoded = render_heatmap_overlay_png_base64(original_image, sensitivity_map)

    decoded_bytes = base64.b64decode(encoded)
    decoded_image = Image.open(io.BytesIO(decoded_bytes))
    assert decoded_image.format == "PNG"
    assert decoded_image.size == (48, 32)
    assert decoded_image.mode == "RGB"


def test_render_heatmap_overlay_respects_alpha_of_zero_leaving_image_unchanged() -> None:
    # alpha=0.0 means Image.blend returns (approximately) the original image
    # unchanged, since the heatmap contributes 0% of the blend.
    grid = np.ones((8, 8), dtype=np.float32)
    sensitivity_map = SensitivityMap(grid=grid, target_class_index=0)
    original_image = Image.new("RGB", (16, 16), (10, 20, 30))

    encoded = render_heatmap_overlay_png_base64(original_image, sensitivity_map, alpha=0.0)
    decoded_bytes = base64.b64decode(encoded)
    decoded_image = Image.open(io.BytesIO(decoded_bytes)).convert("RGB")

    pixel = decoded_image.getpixel((0, 0))
    assert pixel == (10, 20, 30)


def test_render_heatmap_overlay_handles_a_non_rgb_input_image() -> None:
    # original_image.convert("RGB") inside the function must handle a
    # grayscale ("L") input without raising.
    grid = np.zeros((8, 8), dtype=np.float32)
    sensitivity_map = SensitivityMap(grid=grid, target_class_index=0)
    original_image = Image.new("L", (16, 16), 128)

    encoded = render_heatmap_overlay_png_base64(original_image, sensitivity_map)
    decoded_bytes = base64.b64decode(encoded)
    decoded_image = Image.open(io.BytesIO(decoded_bytes))
    assert decoded_image.mode == "RGB"
