"""Orchestrates one /predict call: decode -> quality check -> preprocess ->
ONNX inference -> softmax -> abstention decision -> response shape. Kept
separate from app/main.py's route handler so the logic is directly
unit-testable without spinning up a FastAPI TestClient for every case.
"""

from __future__ import annotations

import time
from dataclasses import dataclass

import numpy as np
from PIL import Image

from app.abstention import compute_entropy, decide_abstention
from app.demo_fallback import DEMO_FALLBACK_DISCLAIMER, compute_demo_fallback
from app.imaging import QualityCheckResult, check_quality, preprocess_for_model
from app.model_registry import PREPROCESSING_VERSION, LoadedModel, run_inference

DISCLAIMER = (
    "This is a probabilistic model output for human verifiers, not a final "
    "determination — a Verifier's review and decision are always required "
    "and this output never bypasses that review."
)


def _softmax(logits: np.ndarray) -> np.ndarray:
    shifted = logits - np.max(logits)
    exp = np.exp(shifted)
    result: np.ndarray = exp / np.sum(exp)
    return result


@dataclass(frozen=True)
class PredictionResult:
    prediction: str
    calibrated_probabilities: dict[str, float]
    confidence: float
    entropy: float
    abstained: bool
    abstention_reasons: tuple[str, ...]
    quality: QualityCheckResult
    latency_ms: float
    is_demo_fallback: bool
    disclaimer: str


def run_prediction(
    model: LoadedModel | None,
    image_bytes: bytes,
    image: Image.Image,
    demo_mode: bool,
) -> PredictionResult:
    """`model` is None exactly when ModelRegistry has no loaded model — the
    caller (app/main.py) is responsible for deciding whether that's
    recoverable via demo_mode or should surface as a 503, since that
    decision also involves HTTP-layer concerns (status code) this function
    shouldn't need to know about."""
    start = time.perf_counter()
    quality = check_quality(image)

    if model is None:
        if not demo_mode:
            raise RuntimeError("No model loaded and demo_mode is disabled")
        fallback = compute_demo_fallback(image_bytes)
        latency_ms = (time.perf_counter() - start) * 1000
        return PredictionResult(
            prediction=fallback.predicted_class,
            calibrated_probabilities=fallback.probabilities,
            confidence=fallback.confidence,
            entropy=0.0,
            abstained=False,
            abstention_reasons=(),
            quality=quality,
            latency_ms=latency_ms,
            is_demo_fallback=True,
            disclaimer=DEMO_FALLBACK_DISCLAIMER,
        )

    preprocessed = preprocess_for_model(image, model.preprocessing)
    logits = run_inference(model, preprocessed)
    probabilities = _softmax(logits)

    predicted_index = int(np.argmax(probabilities))
    predicted_class = model.classes[predicted_index]
    confidence = float(probabilities[predicted_index])

    abstention = decide_abstention(probabilities, quality.quality_score)

    probabilities_by_class = {
        class_name: float(probabilities[i]) for i, class_name in enumerate(model.classes)
    }
    entropy = compute_entropy(probabilities)

    latency_ms = (time.perf_counter() - start) * 1000

    return PredictionResult(
        prediction=predicted_class,
        calibrated_probabilities=probabilities_by_class,
        confidence=confidence,
        entropy=entropy,
        abstained=abstention.abstained,
        abstention_reasons=abstention.reasons,
        quality=quality,
        latency_ms=latency_ms,
        is_demo_fallback=False,
        disclaimer=DISCLAIMER,
    )


__all__ = ["PREPROCESSING_VERSION", "PredictionResult", "run_prediction", "DISCLAIMER"]
