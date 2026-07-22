"""Model factory: builds one of the three benchmark candidate architectures
(MobileNetV3-Large, EfficientNetV2-S, ConvNeXt-Tiny) as an ImageNet-pretrained
torchvision backbone with a new classification head sized to the dataset's
class count — the "transfer learning" this block requires, not
training-from-scratch.

All three torchvision architectures expose `.features` (the convolutional
backbone) and `.classifier` (a `nn.Sequential` ending in the final
`nn.Linear`) in a compatible enough shape that one factory function can
build any of them uniformly — verified against the installed torchvision
version, not assumed from documentation, since exact submodule structure
has changed across torchvision releases.
"""

from __future__ import annotations

from dataclasses import dataclass

import torch
from torch import nn
from torchvision.models import (
    ConvNeXt_Tiny_Weights,
    EfficientNet_V2_S_Weights,
    MobileNet_V3_Large_Weights,
    convnext_tiny,
    efficientnet_v2_s,
    mobilenet_v3_large,
)

ARCHITECTURE_BUILDERS = {
    "mobilenet_v3_large": (mobilenet_v3_large, MobileNet_V3_Large_Weights.DEFAULT),
    "efficientnet_v2_s": (efficientnet_v2_s, EfficientNet_V2_S_Weights.DEFAULT),
    "convnext_tiny": (convnext_tiny, ConvNeXt_Tiny_Weights.DEFAULT),
}


class UnknownArchitectureError(ValueError):
    """Raised when a requested architecture name isn't one of the three benchmark candidates."""


@dataclass(frozen=True)
class ModelBuildResult:
    model: nn.Module
    architecture: str
    num_classes: int
    pretrained_weights_name: str


def _replace_final_linear(classifier: nn.Sequential, num_classes: int) -> None:
    """Replaces the last nn.Linear in a classifier Sequential with a
    freshly-initialized one sized to num_classes — in place, since the
    Sequential is already attached to the model's module tree and swapping
    the whole attribute would lose that attachment for some torchvision
    module implementations."""
    last_index = len(classifier) - 1
    last_layer = classifier[last_index]
    if not isinstance(last_layer, nn.Linear):
        raise TypeError(
            f"Expected the final classifier layer to be nn.Linear, got {type(last_layer).__name__}"
        )
    classifier[last_index] = nn.Linear(last_layer.in_features, num_classes)


def build_model(architecture: str, num_classes: int) -> ModelBuildResult:
    """Builds `architecture` pretrained on ImageNet, with its final
    classification layer replaced by a freshly-initialized nn.Linear sized to
    num_classes. The new layer's weights are NOT pretrained — only the
    backbone is transfer-learned; the head must be trained from scratch on
    the target task, which is why frozen_backbone_warmup_epochs (see
    config.py) exists as a distinct training phase."""
    if architecture not in ARCHITECTURE_BUILDERS:
        raise UnknownArchitectureError(
            f"Unknown architecture '{architecture}', must be one of {tuple(ARCHITECTURE_BUILDERS)}"
        )

    builder, weights = ARCHITECTURE_BUILDERS[architecture]
    model = builder(weights=weights)

    if not hasattr(model, "classifier") or not isinstance(model.classifier, nn.Sequential):
        raise TypeError(f"{architecture}: expected a .classifier nn.Sequential attribute")

    _replace_final_linear(model.classifier, num_classes)

    return ModelBuildResult(
        model=model,
        architecture=architecture,
        num_classes=num_classes,
        pretrained_weights_name=str(weights),
    )


def set_backbone_trainable(model: nn.Module, trainable: bool) -> None:
    """Freezes/unfreezes every parameter under model.features (the backbone) —
    the classifier head's parameters are never touched here, since the head
    must always be trainable (it's freshly initialized, per build_model's own
    doc comment) regardless of the backbone's frozen/unfrozen phase."""
    features = getattr(model, "features", None)
    if not isinstance(features, nn.Module):
        raise TypeError("Model has no .features submodule to freeze/unfreeze")
    for param in features.parameters():
        param.requires_grad = trainable


def count_trainable_parameters(model: nn.Module) -> int:
    return sum(p.numel() for p in model.parameters() if p.requires_grad)


def count_total_parameters(model: nn.Module) -> int:
    return sum(p.numel() for p in model.parameters())


def model_size_bytes(model: nn.Module) -> int:
    """Approximates the model's serialized size as (parameter count + buffer
    count) * 4 bytes (float32) — a coarse but dependency-free proxy for the
    "model size" benchmark criterion; the benchmark report also records an
    actual on-disk checkpoint size (see checkpoints.py) as the authoritative
    figure, since this in-memory estimate doesn't account for
    serialization/compression overhead the real artifact will have."""
    param_bytes = sum(p.numel() * p.element_size() for p in model.parameters())
    buffer_bytes = sum(b.numel() * b.element_size() for b in model.buffers())
    return param_bytes + buffer_bytes


def resolve_device() -> torch.device:
    """CUDA if available, else CPU — the single place device selection
    happens, so "mixed precision when available" (config.py) and every
    other CUDA-conditional behavior checks the same resolved device rather
    than each re-querying torch.cuda.is_available() independently."""
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")
