from __future__ import annotations

from pathlib import Path

import pytest
from PIL import Image

from app.imaging import check_quality, preprocess_for_model
from app.inference import DISCLAIMER, run_prediction
from app.model_registry import ModelRegistry

from .test_model_registry import _write_valid_artifact


def _real_looking_image(width: int = 300, height: int = 300) -> Image.Image:
    image = Image.new("RGB", (width, height))
    pixels = image.load()
    assert pixels is not None
    for y in range(height):
        for x in range(width):
            pixels[x, y] = ((x * 7) % 256, (y * 13) % 256, ((x + y) * 3) % 256)
    return image


def test_run_prediction_raises_when_no_model_and_demo_mode_disabled() -> None:
    image = _real_looking_image()
    with pytest.raises(RuntimeError, match="No model loaded and demo_mode is disabled"):
        run_prediction(model=None, image_bytes=b"fake bytes", image=image, demo_mode=False)


def test_run_prediction_falls_back_deterministically_when_no_model_and_demo_mode_enabled() -> None:
    image = _real_looking_image()
    image_bytes = b"some fake bytes for the demo fallback hash"

    result = run_prediction(model=None, image_bytes=image_bytes, image=image, demo_mode=True)

    assert result.is_demo_fallback is True
    assert result.abstained is False
    assert result.abstention_reasons == ()
    assert result.entropy == 0.0
    assert "DEMO_MODE" in result.disclaimer
    assert abs(sum(result.calibrated_probabilities.values()) - 1.0) < 1e-9
    assert result.quality.passed is True


def test_run_prediction_demo_fallback_is_deterministic_for_the_same_bytes() -> None:
    image = _real_looking_image()
    image_bytes = b"identical payload"

    first = run_prediction(model=None, image_bytes=image_bytes, image=image, demo_mode=True)
    second = run_prediction(model=None, image_bytes=image_bytes, image=image, demo_mode=True)

    assert first.prediction == second.prediction
    assert first.calibrated_probabilities == second.calibrated_probabilities


def test_run_prediction_with_a_loaded_model_produces_a_full_shaped_result(tmp_path: Path) -> None:
    _write_valid_artifact(tmp_path)
    registry = ModelRegistry(tmp_path)
    registry.load()
    model = registry.require_loaded()

    image = _real_looking_image()
    result = run_prediction(model=model, image_bytes=b"irrelevant", image=image, demo_mode=False)

    assert result.is_demo_fallback is False
    assert result.disclaimer == DISCLAIMER
    assert result.prediction in model.classes
    assert set(result.calibrated_probabilities.keys()) == set(model.classes)
    assert abs(sum(result.calibrated_probabilities.values()) - 1.0) < 1e-5
    assert 0.0 <= result.confidence <= 1.0
    assert result.entropy >= 0.0
    assert result.latency_ms >= 0.0
    assert result.calibrated_probabilities[result.prediction] == max(
        result.calibrated_probabilities.values()
    )


def test_run_prediction_confidence_matches_the_predicted_classs_probability(
    tmp_path: Path,
) -> None:
    _write_valid_artifact(tmp_path)
    registry = ModelRegistry(tmp_path)
    registry.load()
    model = registry.require_loaded()

    image = _real_looking_image()
    result = run_prediction(model=model, image_bytes=b"irrelevant", image=image, demo_mode=False)

    assert abs(result.confidence - result.calibrated_probabilities[result.prediction]) < 1e-6


def test_run_prediction_reports_quality_consistent_with_check_quality(tmp_path: Path) -> None:
    _write_valid_artifact(tmp_path)
    registry = ModelRegistry(tmp_path)
    registry.load()
    model = registry.require_loaded()

    image = Image.new("RGB", (50, 50), (128, 128, 128))  # low-res, flat: fails quality
    expected_quality = check_quality(image)

    result = run_prediction(model=model, image_bytes=b"irrelevant", image=image, demo_mode=False)

    assert result.quality == expected_quality
    assert result.quality.passed is False


def test_run_prediction_uses_the_models_own_preprocessing_spec(tmp_path: Path) -> None:
    # Sanity check that preprocess_for_model (used internally by
    # run_prediction) is driven by the artifact's own preprocessing spec,
    # not a hardcoded resolution — resolution_px=4 in the test artifact.
    _write_valid_artifact(tmp_path)
    registry = ModelRegistry(tmp_path)
    registry.load()
    model = registry.require_loaded()
    assert model.preprocessing.resolution_px == 4

    image = _real_looking_image()
    tensor = preprocess_for_model(image, model.preprocessing)
    assert tensor.shape == (1, 3, 4, 4)
