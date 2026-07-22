"""Image decode, quality checks, and preprocessing for apps/ml-api.

Quality thresholds mirror ml/configs/dataset.yaml's quality section
(BLOCK 18) — a ground-level citizen photo below these floors was already
excluded from training data, so the same floor applies at serving time
(consistency between "what the model was trained to see" and "what we
accept for inference"), even though it's a separate, independent
implementation (this service never imports ml/ directly, per AGENTS.md's
architecture boundary — apps/ml-api and ml/ are separate Python projects).
"""

from __future__ import annotations

import base64
import binascii
import io
from dataclasses import dataclass

import numpy as np
from PIL import Image, ImageStat, UnidentifiedImageError

from app.model_registry import PreprocessingSpec

MIN_WIDTH_PX = 200
MIN_HEIGHT_PX = 200
MAX_DECODED_BYTES = 25 * 1024 * 1024
ALLOWED_MIME_TYPES = frozenset({"image/jpeg", "image/png", "image/webp"})

# Below this, a photo is judged too flat/low-contrast to be a meaningful
# damage-assessment subject (e.g. a solid wall, fully dark frame, or a
# decode artifact) — a coarse standard-deviation-of-grayscale heuristic,
# deliberately simple and explainable rather than a second ML model.
MIN_GRAYSCALE_STDDEV = 8.0


class ImageDecodeError(ValueError):
    """Raised when the supplied image cannot be safely decoded."""


@dataclass(frozen=True)
class QualityCheckResult:
    quality_score: float
    passed: bool
    reasons: tuple[str, ...]


def decode_image(image_base64: str, mime_type: str) -> tuple[bytes, Image.Image]:
    """Returns (raw_decoded_bytes, decoded_image) — the raw bytes are
    reused by the demo fallback's deterministic hash input, so this
    decodes base64 exactly once rather than making each caller re-decode
    it independently."""
    if mime_type not in ALLOWED_MIME_TYPES:
        raise ImageDecodeError(f"Unsupported mime type '{mime_type}'")

    try:
        raw_bytes = base64.b64decode(image_base64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ImageDecodeError("Image payload is not valid base64") from exc

    if len(raw_bytes) == 0:
        raise ImageDecodeError("Image payload is empty")
    if len(raw_bytes) > MAX_DECODED_BYTES:
        raise ImageDecodeError(
            f"Decoded image is {len(raw_bytes)} bytes, exceeding the {MAX_DECODED_BYTES} byte limit"
        )

    try:
        image = Image.open(io.BytesIO(raw_bytes))
        image.load()
    except UnidentifiedImageError as exc:
        raise ImageDecodeError("Could not identify image format") from exc
    except OSError as exc:
        raise ImageDecodeError(f"Image is corrupt or truncated: {exc}") from exc

    return raw_bytes, image.convert("RGB")


def check_quality(image: Image.Image) -> QualityCheckResult:
    """Deliberately simple, explainable checks (dimensions, contrast) — a
    proxy for "is this photo usable at all," never a claim about whether it
    depicts real damage. Feeds RISK_REGISTER.md risk #4's "quality signal
    computed and surfaced explicitly to the Verifier" requirement."""
    reasons: list[str] = []

    width, height = image.size
    if width < MIN_WIDTH_PX or height < MIN_HEIGHT_PX:
        reasons.append(
            f"resolution {width}x{height}px is below the {MIN_WIDTH_PX}x{MIN_HEIGHT_PX}px minimum"
        )

    grayscale = image.convert("L")
    stddev = ImageStat.Stat(grayscale).stddev[0]
    if stddev < MIN_GRAYSCALE_STDDEV:
        reasons.append(
            f"image contrast (stddev={stddev:.1f}) is below the {MIN_GRAYSCALE_STDDEV} minimum"
        )

    # A simple composite score: 1.0 when both checks pass fully, degrading
    # smoothly as either falls short, clamped to [0, 1] — never a step
    # function that would make a borderline image swing wildly between
    # "quality 1.0" and "quality 0.0" for a one-pixel difference.
    dimension_ratio = min(1.0, min(width, height) / max(MIN_WIDTH_PX, MIN_HEIGHT_PX))
    contrast_ratio = min(1.0, stddev / (MIN_GRAYSCALE_STDDEV * 2))
    quality_score = round(min(1.0, max(0.0, (dimension_ratio + contrast_ratio) / 2)), 3)

    return QualityCheckResult(
        quality_score=quality_score, passed=len(reasons) == 0, reasons=tuple(reasons)
    )


def preprocess_for_model(image: Image.Image, spec: PreprocessingSpec) -> np.ndarray:
    """Resize + ImageNet-style normalization, matching
    ml/src/training/dataset.py's build_transform (BLOCK 19/20) and the
    preprocessing spec exported alongside the model (BLOCK 20's
    export.py) — this is the one place apps/ml-api reimplements that
    logic (never importing ml/ directly, per the architecture boundary),
    so it must be kept in lockstep with the exported preprocessing spec by
    reading resolution/mean/std FROM that spec rather than hardcoding
    them, which is exactly what this function does."""
    resized = image.resize((spec.resolution_px, spec.resolution_px), Image.Resampling.BILINEAR)
    array = np.asarray(resized, dtype=np.float32) / 255.0

    mean = np.array(spec.normalization_mean, dtype=np.float32)
    std = np.array(spec.normalization_std, dtype=np.float32)
    normalized = (array - mean) / std

    # HWC -> CHW, add batch dimension -> (1, 3, H, W), matching the ONNX
    # export's expected input layout (export_onnx in ml/src/training/export.py).
    chw = np.transpose(normalized, (2, 0, 1))
    batched = np.expand_dims(chw, axis=0).astype(np.float32)
    return batched
