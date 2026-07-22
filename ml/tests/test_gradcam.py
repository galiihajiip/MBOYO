from __future__ import annotations

import numpy as np
import pytest
import torch
from PIL import Image
from torch import nn

from training.gradcam import (
    GRAD_CAM_DISCLAIMER,
    GradCamUnsupportedModelError,
    compute_grad_cam,
    render_overlay,
)


class _TinyFeatureModel(nn.Module):
    """A minimal model with the same `.features` shape convention as
    models.py's torchvision backbones (a Sequential of conv blocks) — used
    so these tests don't need to download real pretrained weights."""

    def __init__(self, num_classes: int = 3) -> None:
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 4, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.Conv2d(4, 8, kernel_size=3, padding=1),
        )
        self.pool = nn.AdaptiveAvgPool2d(1)
        self.classifier = nn.Sequential(nn.Flatten(), nn.Linear(8, num_classes))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        features = self.features(x)
        pooled = self.pool(features)
        output: torch.Tensor = self.classifier(pooled)
        return output


@pytest.fixture
def tiny_model() -> _TinyFeatureModel:
    torch.manual_seed(0)
    return _TinyFeatureModel()


def test_compute_grad_cam_returns_map_at_input_resolution(tiny_model: _TinyFeatureModel) -> None:
    x = torch.randn(1, 3, 32, 32)
    result = compute_grad_cam(tiny_model, x)
    assert result.class_activation_map.shape == (32, 32)


def test_compute_grad_cam_map_is_normalized_to_unit_range(tiny_model: _TinyFeatureModel) -> None:
    x = torch.randn(1, 3, 32, 32)
    result = compute_grad_cam(tiny_model, x)
    assert result.class_activation_map.min() >= 0.0
    assert result.class_activation_map.max() <= 1.0 + 1e-6


def test_compute_grad_cam_works_with_frozen_parameters(tiny_model: _TinyFeatureModel) -> None:
    """Regression test: a model whose backbone is frozen
    (requires_grad=False, per set_backbone_trainable) must still support
    Grad-CAM — the input tensor must be forced to require grad since no
    parameter otherwise does."""
    for param in tiny_model.parameters():
        param.requires_grad = False

    x = torch.randn(1, 3, 32, 32)
    result = compute_grad_cam(tiny_model, x)
    assert result.class_activation_map.shape == (32, 32)


def test_compute_grad_cam_respects_explicit_target_class(tiny_model: _TinyFeatureModel) -> None:
    x = torch.randn(1, 3, 32, 32)
    result = compute_grad_cam(tiny_model, x, target_class_index=1)
    assert result.predicted_class_index == 1


def test_compute_grad_cam_disclaimer_is_attached(tiny_model: _TinyFeatureModel) -> None:
    x = torch.randn(1, 3, 32, 32)
    result = compute_grad_cam(tiny_model, x)
    assert result.disclaimer == GRAD_CAM_DISCLAIMER
    assert "not a causal explanation" in result.disclaimer


def test_compute_grad_cam_rejects_model_without_features() -> None:
    model = nn.Linear(4, 2)
    x = torch.randn(1, 4)
    with pytest.raises(GradCamUnsupportedModelError):
        compute_grad_cam(model, x)


def test_render_overlay_returns_same_size_rgb_image() -> None:
    image = Image.new("RGB", (16, 16), (100, 100, 100))
    cam = np.random.default_rng(0).random((16, 16)).astype(np.float32)
    overlay = render_overlay(image, cam)
    assert overlay.size == (16, 16)
    assert overlay.mode == "RGB"


def test_render_overlay_rejects_mismatched_cam_shape() -> None:
    image = Image.new("RGB", (16, 16))
    cam = np.zeros((8, 8), dtype=np.float32)
    with pytest.raises(ValueError, match="does not match"):
        render_overlay(image, cam)


def test_render_overlay_hot_regions_differ_from_cold_regions() -> None:
    image = Image.new("RGB", (4, 4), (128, 128, 128))
    cam = np.zeros((4, 4), dtype=np.float32)
    cam[0, 0] = 1.0  # hot corner
    cam[3, 3] = 0.0  # cold corner
    overlay = render_overlay(image, cam, alpha=1.0)
    hot_pixel = overlay.getpixel((0, 0))
    cold_pixel = overlay.getpixel((3, 3))
    assert hot_pixel != cold_pixel
