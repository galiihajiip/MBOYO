from __future__ import annotations

import base64
import io

import pytest
from PIL import Image

from app.imaging import ImageDecodeError, check_quality, decode_image, preprocess_for_model
from app.model_registry import PreprocessingSpec


def _make_image_base64(
    width: int, height: int, color: tuple[int, int, int], fmt: str = "JPEG"
) -> str:
    image = Image.new("RGB", (width, height), color)
    buffer = io.BytesIO()
    image.save(buffer, format=fmt)
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def test_decode_image_rejects_unsupported_mime_type() -> None:
    with pytest.raises(ImageDecodeError, match="Unsupported mime type"):
        decode_image(_make_image_base64(300, 300, (10, 10, 10)), "image/gif")


def test_decode_image_rejects_invalid_base64() -> None:
    with pytest.raises(ImageDecodeError, match="not valid base64"):
        decode_image("not-valid-base64!!!", "image/jpeg")


def test_decode_image_rejects_empty_payload() -> None:
    with pytest.raises(ImageDecodeError, match="empty"):
        decode_image(base64.b64encode(b"").decode("ascii"), "image/jpeg")


def test_decode_image_rejects_corrupt_bytes() -> None:
    garbage = base64.b64encode(b"not a real image, just garbage bytes" * 10).decode("ascii")
    with pytest.raises(ImageDecodeError):
        decode_image(garbage, "image/jpeg")


def test_decode_image_returns_bytes_and_rgb_image() -> None:
    raw_bytes, image = decode_image(_make_image_base64(300, 300, (200, 100, 50)), "image/jpeg")
    assert len(raw_bytes) > 0
    assert image.mode == "RGB"
    assert image.size == (300, 300)


def test_check_quality_flags_low_resolution() -> None:
    image = Image.new("RGB", (50, 50), (100, 100, 100))
    result = check_quality(image)
    assert not result.passed
    assert any("resolution" in reason for reason in result.reasons)


def test_check_quality_flags_low_contrast_flat_image() -> None:
    image = Image.new("RGB", (300, 300), (128, 128, 128))
    result = check_quality(image)
    assert not result.passed
    assert any("contrast" in reason for reason in result.reasons)


def test_check_quality_passes_a_real_looking_image() -> None:
    image = Image.new("RGB", (300, 300))
    pixels = image.load()
    assert pixels is not None
    for y in range(300):
        for x in range(300):
            pixels[x, y] = ((x * 7) % 256, (y * 13) % 256, ((x + y) * 3) % 256)
    result = check_quality(image)
    assert result.passed
    assert result.reasons == ()


def test_preprocess_for_model_produces_expected_shape() -> None:
    image = Image.new("RGB", (500, 400), (50, 60, 70))
    spec = PreprocessingSpec(
        resolution_px=224,
        normalization_mean=(0.485, 0.456, 0.406),
        normalization_std=(0.229, 0.224, 0.225),
    )
    tensor = preprocess_for_model(image, spec)
    assert tensor.shape == (1, 3, 224, 224)
    assert tensor.dtype.name == "float32"
