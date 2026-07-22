"""Occlusion-based sensitivity map for /explain — an ONNX-Runtime-compatible
explainability technique, NOT Grad-CAM.

ml/src/training/gradcam.py (BLOCK 20) implements true Grad-CAM via PyTorch
forward/backward hooks — but apps/ml-api serves exclusively via ONNX
Runtime (per docs/product/SUCCESS_METRICS.md's CPU/ONNX Runtime serving
path) and never imports PyTorch or ml/ directly (AGENTS.md architecture
boundary). A standard ONNX Runtime inference session exposes no gradients,
so true Grad-CAM cannot be reproduced here without either adding a full
PyTorch dependency or a training-capable ONNX Runtime build purely to
compute one explanation — disclosed as a deliberate, user-approved
trade-off rather than silently mislabeling this technique as Grad-CAM.

Occlusion sensitivity (Zeiler & Fergus, 2014): slide an occluding patch
(mid-gray) over the image on a grid, re-run inference at each position, and
record how much the target class's probability drops when that region is
occluded. A region whose removal drops confidence a lot is "important" to
the prediction. This is a legitimate, well-established black-box
explainability technique — but it has different properties from Grad-CAM
(coarser, grid-resolution-limited, and requires N re-inference calls rather
than one backward pass) and this is disclosed in every response via
`OCCLUSION_DISCLAIMER`, which is deliberately distinct from BLOCK 20's
GRAD_CAM_DISCLAIMER text so a reader never conflates the two techniques.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.model_registry import LoadedModel, run_inference

OCCLUSION_DISCLAIMER = (
    "This heatmap shows which coarse image regions most affect the model's "
    "predicted probability when occluded (occlusion-based sensitivity, not "
    "Grad-CAM) — it is a correlational visualization, not a causal "
    "explanation. A highlighted region is not proof of damage and does not "
    "indicate the prediction is correct. Use it only as an aid to your own "
    "independent judgment, never as a substitute for it."
)

GRID_SIZE = 8
# 0.0 in normalized space is a neutral mid-gray fill (the exact un-normalized
# gray value is dataset-dependent, but 0.0 post-normalization is a
# reasonable, simple neutral occluding value regardless of the dataset's
# specific mean/std).
OCCLUSION_VALUE = 0.0


@dataclass(frozen=True)
class SensitivityMap:
    """(GRID_SIZE, GRID_SIZE) floats in [0, 1], 1.0 = occluding this cell
    dropped the target class's probability the most (most important)."""

    grid: np.ndarray
    target_class_index: int


def _softmax(logits: np.ndarray) -> np.ndarray:
    shifted = logits - np.max(logits)
    exp = np.exp(shifted)
    result: np.ndarray = exp / np.sum(exp)
    return result


def compute_occlusion_sensitivity(
    model: LoadedModel, preprocessed_image: np.ndarray, target_class_index: int | None = None
) -> SensitivityMap:
    """`preprocessed_image` is the (1, 3, H, W) normalized tensor
    app/imaging.py's preprocess_for_model produces. Runs GRID_SIZE^2 + 1
    inference calls total (one baseline + one per grid cell) — deliberately
    coarse (an 8x8 grid, not per-pixel) to keep latency bounded, since this
    is an internal /explain endpoint, not the hot /predict path."""
    baseline_logits = run_inference(model, preprocessed_image)
    baseline_probabilities = _softmax(baseline_logits)

    if target_class_index is None:
        target_class_index = int(np.argmax(baseline_probabilities))

    baseline_target_probability = float(baseline_probabilities[target_class_index])

    _, _, height, width = preprocessed_image.shape
    cell_height = max(1, height // GRID_SIZE)
    cell_width = max(1, width // GRID_SIZE)

    sensitivity = np.zeros((GRID_SIZE, GRID_SIZE), dtype=np.float32)

    for row in range(GRID_SIZE):
        for col in range(GRID_SIZE):
            occluded = preprocessed_image.copy()
            row_start, row_end = row * cell_height, min(height, (row + 1) * cell_height)
            col_start, col_end = col * cell_width, min(width, (col + 1) * cell_width)
            occluded[:, :, row_start:row_end, col_start:col_end] = OCCLUSION_VALUE

            occluded_logits = run_inference(model, occluded)
            occluded_probabilities = _softmax(occluded_logits)
            occluded_target_probability = float(occluded_probabilities[target_class_index])

            drop = baseline_target_probability - occluded_target_probability
            sensitivity[row, col] = max(0.0, drop)

    max_drop = float(sensitivity.max())
    if max_drop > 1e-8:
        sensitivity = sensitivity / max_drop

    return SensitivityMap(grid=sensitivity, target_class_index=target_class_index)
