"""Renders a SensitivityMap (app/explain.py) as a base64 PNG heatmap overlay
on the original image — pure Pillow, no OpenCV, matching
ml/src/training/gradcam.py's render_overlay technique (BLOCK 20) for visual
consistency across both explainability paths, even though the underlying
map is computed differently (occlusion sensitivity here, true Grad-CAM
there).
"""

from __future__ import annotations

import base64
import io

import numpy as np
from PIL import Image

from app.explain import SensitivityMap


def _upsample_grid_to_image_size(grid: np.ndarray, width: int, height: int) -> np.ndarray:
    """Nearest-neighbor upsample from the coarse grid to full image
    resolution — matches the blocky, grid-resolution-limited nature of
    occlusion sensitivity honestly, rather than smoothing it into something
    that looks falsely precise."""
    grid_image = Image.fromarray((grid * 255).astype(np.uint8), mode="L")
    upsampled = grid_image.resize((width, height), Image.Resampling.NEAREST)
    return np.asarray(upsampled, dtype=np.float32) / 255.0


def _heat_color(value: float) -> tuple[int, int, int]:
    """Blue -> yellow -> red colormap, identical formula to
    ml/src/training/gradcam.py's _heat_color, for visual consistency."""
    value = max(0.0, min(1.0, value))
    if value < 0.5:
        t = value / 0.5
        return (int(255 * t), int(255 * t), int(255 * (1 - t)))
    t = (value - 0.5) / 0.5
    return (255, int(255 * (1 - t)), 0)


def render_heatmap_overlay_png_base64(
    original_image: Image.Image, sensitivity_map: SensitivityMap, alpha: float = 0.45
) -> str:
    width, height = original_image.size
    upsampled = _upsample_grid_to_image_size(sensitivity_map.grid, width, height)

    heatmap_rgb = np.zeros((height, width, 3), dtype=np.uint8)
    lower_half = upsampled < 0.5
    t_lower = np.where(lower_half, upsampled / 0.5, 0.0)
    t_upper = np.where(~lower_half, (upsampled - 0.5) / 0.5, 0.0)

    heatmap_rgb[..., 0] = np.where(lower_half, t_lower * 255, 255).astype(np.uint8)
    heatmap_rgb[..., 1] = np.where(lower_half, t_lower * 255, (1 - t_upper) * 255).astype(np.uint8)
    heatmap_rgb[..., 2] = np.where(lower_half, (1 - t_lower) * 255, 0).astype(np.uint8)

    heatmap_image = Image.fromarray(heatmap_rgb, mode="RGB")
    base_image = original_image.convert("RGB")
    overlay = Image.blend(base_image, heatmap_image, alpha=alpha)

    buffer = io.BytesIO()
    overlay.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")
