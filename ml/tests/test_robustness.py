from __future__ import annotations

import numpy as np
import pytest
from PIL import Image

from training.robustness import DegradationSpec, apply_degradation


@pytest.fixture
def sample_image() -> Image.Image:
    return Image.new("RGB", (64, 64), (150, 100, 50))


def test_gaussian_blur_returns_same_size_image(sample_image: Image.Image) -> None:
    result = apply_degradation(sample_image, DegradationSpec("gaussian_blur", {"kernel_size": 9}))
    assert result.size == sample_image.size
    assert result.mode == "RGB"


def test_low_light_darkens_the_image(sample_image: Image.Image) -> None:
    result = apply_degradation(
        sample_image, DegradationSpec("low_light", {"brightness_factor": 0.3})
    )
    original_pixel = sample_image.getpixel((32, 32))
    degraded_pixel = result.getpixel((32, 32))
    assert isinstance(original_pixel, tuple)
    assert isinstance(degraded_pixel, tuple)
    original_mean = sum(original_pixel) / 3
    degraded_mean = sum(degraded_pixel) / 3
    assert degraded_mean < original_mean


def test_jpeg_compression_artifact_returns_valid_image(sample_image: Image.Image) -> None:
    result = apply_degradation(
        sample_image, DegradationSpec("jpeg_compression_artifact", {"quality": 10})
    )
    assert result.size == sample_image.size
    assert result.mode == "RGB"


def test_apply_degradation_does_not_mutate_input(sample_image: Image.Image) -> None:
    original_bytes = sample_image.tobytes()
    apply_degradation(sample_image, DegradationSpec("gaussian_blur", {"kernel_size": 9}))
    assert sample_image.tobytes() == original_bytes


def test_unknown_degradation_raises(sample_image: Image.Image) -> None:
    with pytest.raises(ValueError, match="Unknown degradation"):
        apply_degradation(sample_image, DegradationSpec("not_a_real_degradation", {}))


def test_low_resolution_returns_same_size_image(sample_image: Image.Image) -> None:
    result = apply_degradation(
        sample_image, DegradationSpec("low_resolution", {"scale_factor": 0.25})
    )
    assert result.size == sample_image.size
    assert result.mode == "RGB"


def test_low_resolution_actually_loses_detail() -> None:
    # A checkerboard pattern loses its fine detail when downscaled then
    # upscaled back — verified by comparing pixel variance, which should
    # drop noticeably once high-frequency detail is destroyed.
    image = Image.new("RGB", (64, 64))
    pixels = image.load()
    assert pixels is not None
    for x in range(64):
        for y in range(64):
            pixels[x, y] = (255, 255, 255) if (x + y) % 2 == 0 else (0, 0, 0)

    degraded = apply_degradation(image, DegradationSpec("low_resolution", {"scale_factor": 0.1}))
    original_variance = np.var(np.array(image))
    degraded_variance = np.var(np.array(degraded))
    assert degraded_variance < original_variance
