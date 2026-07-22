"""Grad-CAM (Selvaraju et al., 2017) for Verifier-facing explainability —
a heatmap over the input image showing which spatial regions most
influenced the model's predicted class, computed from the gradient of the
predicted class's logit with respect to the final convolutional feature
map in `model.features` (the same submodule every architecture in
models.py exposes uniformly).

Pure PyTorch + Pillow, no OpenCV: cv2 is confirmed unusable in this
environment (see robustness.py's docstring — a NumPy 2.x ABI
incompatibility), and most Grad-CAM libraries (e.g. pytorch-grad-cam)
assume cv2 for resizing the coarse CAM and for `applyColorMap`-style
overlay — both are reimplemented here directly: PIL's own bilinear
resize for upsampling, and a small hand-rolled colormap for the overlay.

CRITICAL — the non-causal disclaimer (required by this block, and by
AGENTS.md's "model outputs are probabilistic signals, not final
determinations" rule): Grad-CAM shows CORRELATION between image regions
and the model's output, computed via gradients — it is NOT a causal
explanation of "why" the model is right or wrong, and a highlighted region
does not mean that region is damage, or that the model's classification is
correct. `GRAD_CAM_DISCLAIMER` below is attached to every result this
module produces and must be surfaced verbatim (or translated, never
paraphrased into a stronger claim) wherever a Grad-CAM overlay is shown.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import torch
import torch.nn.functional as functional_ops
from PIL import Image
from torch import nn

GRAD_CAM_DISCLAIMER = (
    "This heatmap shows which image regions most influenced the model's "
    "prediction, based on gradients — it is a correlational visualization, "
    "not a causal explanation. A highlighted region is not proof of damage "
    "and does not indicate the prediction is correct. Use it only as an "
    "aid to your own independent judgment, never as a substitute for it."
)


class GradCamUnsupportedModelError(ValueError):
    """Raised when a model has no `.features` submodule to hook (see models.py)."""


@dataclass(frozen=True)
class GradCamResult:
    class_activation_map: np.ndarray  # (H, W) floats in [0, 1], input resolution
    predicted_class_index: int
    disclaimer: str = GRAD_CAM_DISCLAIMER


def _last_conv_module(features: nn.Module) -> nn.Module:
    """The final submodule of `.features` is used as the Grad-CAM hook
    target — for a torchvision backbone this is always the last
    convolution-producing block before global pooling, which is exactly
    the feature map Grad-CAM's original formulation targets."""
    children = list(features.children())
    if len(children) == 0:
        raise GradCamUnsupportedModelError("Model's .features submodule has no child layers")
    return children[-1]


def compute_grad_cam(
    model: nn.Module, input_tensor: torch.Tensor, target_class_index: int | None = None
) -> GradCamResult:
    """`input_tensor` is a single already-normalized image, shape
    (1, 3, H, W) — the same preprocessing dataset.py's build_transform
    produces. Returns a (H, W) map matching the INPUT resolution (upsampled
    from the coarse feature-map resolution via bilinear interpolation), so
    it can be overlaid directly on the original image pixel-for-pixel."""
    features = getattr(model, "features", None)
    if not isinstance(features, nn.Module):
        raise GradCamUnsupportedModelError("Model has no .features submodule to hook")

    target_module = _last_conv_module(features)

    activations: dict[str, torch.Tensor] = {}
    gradients: dict[str, torch.Tensor] = {}

    def _forward_hook(
        _module: nn.Module, _input: tuple[torch.Tensor, ...], output: torch.Tensor
    ) -> None:
        activations["value"] = output.detach()

    def _backward_hook(
        _module: nn.Module,
        _grad_input: tuple[torch.Tensor, ...],
        grad_output: tuple[torch.Tensor, ...],
    ) -> None:
        gradients["value"] = grad_output[0].detach()

    forward_handle = target_module.register_forward_hook(_forward_hook)
    backward_handle = target_module.register_full_backward_hook(_backward_hook)

    try:
        was_training = model.training
        model.eval()

        # Grad-CAM backpropagates into an intermediate activation, not the
        # model's parameters — if every parameter is frozen (e.g. a model
        # whose backbone was frozen via set_backbone_trainable(False) and
        # never unfrozen again after training), no tensor in the forward
        # pass would otherwise require grad, and .backward() would fail.
        # Forcing the input to require grad guarantees the graph exists
        # regardless of the model's own parameter-freeze state, without
        # mutating the model's parameters themselves.
        input_tensor = input_tensor.clone().requires_grad_(True)
        logits = model(input_tensor)
        if target_class_index is None:
            target_class_index = int(torch.argmax(logits, dim=1).item())

        model.zero_grad()
        logits[0, target_class_index].backward()

        if was_training:
            model.train()
    finally:
        forward_handle.remove()
        backward_handle.remove()

    if "value" not in activations or "value" not in gradients:
        raise GradCamUnsupportedModelError(
            "Forward/backward hooks did not fire — the target module may not "
            "have been reached during the forward pass"
        )

    feature_map = activations["value"][0]  # (C, h, w)
    grad_map = gradients["value"][0]  # (C, h, w)

    # Global-average-pool the gradients per channel to get each channel's
    # importance weight (the original Grad-CAM formulation), then compute a
    # weighted sum of the feature map channels, followed by ReLU (only
    # positive influence on the target class is kept, per the original
    # paper — negative-influence regions are not "evidence against," so
    # this doesn't warrant a separate map without a stronger justification
    # than this block requires).
    channel_weights = grad_map.mean(dim=(1, 2))  # (C,)
    weighted_sum = torch.einsum("c,chw->hw", channel_weights, feature_map)
    cam = functional_ops.relu(weighted_sum)

    cam_min, cam_max = float(cam.min()), float(cam.max())
    if cam_max - cam_min > 1e-8:
        cam = (cam - cam_min) / (cam_max - cam_min)
    else:
        cam = torch.zeros_like(cam)

    input_height, input_width = input_tensor.shape[2], input_tensor.shape[3]
    cam_upsampled = functional_ops.interpolate(
        cam.unsqueeze(0).unsqueeze(0),
        size=(input_height, input_width),
        mode="bilinear",
        align_corners=False,
    )[0, 0]

    return GradCamResult(
        class_activation_map=cam_upsampled.cpu().numpy(),
        predicted_class_index=target_class_index,
    )


def _heat_color(value: float) -> tuple[int, int, int]:
    """A minimal blue-to-red heat colormap (no cv2 available) — value in
    [0, 1] maps to blue (cold/low activation) through yellow to red
    (hot/high activation), a standard, easily-interpreted CAM palette
    without depending on OpenCV's `COLORMAP_JET`."""
    value = max(0.0, min(1.0, value))
    if value < 0.5:
        # blue -> yellow
        t = value / 0.5
        r = int(255 * t)
        g = int(255 * t)
        b = int(255 * (1 - t))
    else:
        # yellow -> red
        t = (value - 0.5) / 0.5
        r = 255
        g = int(255 * (1 - t))
        b = 0
    return (r, g, b)


def render_overlay(
    original_image: Image.Image, class_activation_map: np.ndarray, alpha: float = 0.45
) -> Image.Image:
    """Blends `class_activation_map` (H, W floats in [0, 1], already at the
    image's resolution) over `original_image` as a semi-transparent heat
    overlay — pure Pillow, built pixel-by-pixel via a small colormap LUT
    rather than cv2.applyColorMap."""
    if class_activation_map.shape != (original_image.height, original_image.width):
        raise ValueError(
            f"class_activation_map shape {class_activation_map.shape} does not match "
            f"image size {(original_image.height, original_image.width)}"
        )

    heatmap_rgb = np.zeros((*class_activation_map.shape, 3), dtype=np.uint8)
    # Vectorized colormap application (equivalent to _heat_color per-pixel,
    # but avoids a Python-level loop over every pixel).
    normalized = np.clip(class_activation_map, 0.0, 1.0)
    lower_half = normalized < 0.5
    t_lower = np.where(lower_half, normalized / 0.5, 0.0)
    t_upper = np.where(~lower_half, (normalized - 0.5) / 0.5, 0.0)

    heatmap_rgb[..., 0] = np.where(lower_half, t_lower * 255, 255).astype(np.uint8)
    heatmap_rgb[..., 1] = np.where(lower_half, t_lower * 255, (1 - t_upper) * 255).astype(np.uint8)
    heatmap_rgb[..., 2] = np.where(lower_half, (1 - t_lower) * 255, 0).astype(np.uint8)

    heatmap_image = Image.fromarray(heatmap_rgb, mode="RGB")
    base_image = original_image.convert("RGB")
    return Image.blend(base_image, heatmap_image, alpha=alpha)
