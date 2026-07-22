"""MBOYO ML inference API entry point.

Stateless FastAPI service, internal-token gated (see app/auth.py), no public
ingress per docs/architecture/DEPLOYMENT_TOPOLOGY.md.

Endpoints:
  GET  /health           liveness — no internal token required (matches the
                          original BLOCK skeleton's public health check;
                          internal-token gating begins at /ready).
  GET  /ready             readiness — waits for a model to be loaded (or,
                          in DEMO_MODE, reports ready with a labeled caveat).
  GET  /model-info        the currently loaded model's identity/release status.
  POST /validate-image    lightweight pre-check, no model required.
  POST /predict           the core inference call.
  POST /explain           occlusion-based sensitivity heatmap (see app/explain.py
                          for why this is not Grad-CAM).
  POST /batch-predict     internal-only batch variant of /predict, for
                          apps/worker (never called by apps/web/browser code).

Model load-once: ModelRegistry.load() runs exactly once, at process startup
(FastAPI's lifespan handler below) — never per-request. /ready reports
False until that load completes (or fails).
"""

from __future__ import annotations

import logging
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from importlib.metadata import PackageNotFoundError, version

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.responses import JSONResponse

from app.auth import require_internal_token
from app.config import Settings, get_settings
from app.explain import compute_occlusion_sensitivity
from app.heatmap import render_heatmap_overlay_png_base64
from app.imaging import ImageDecodeError, check_quality, decode_image, preprocess_for_model
from app.inference import PREPROCESSING_VERSION, run_prediction
from app.logging_setup import configure_json_logging
from app.model_registry import ModelRegistry
from app.observability import init_sentry
from app.origin_guard import StrictOriginMiddleware
from app.rate_limit import RateLimiter
from app.request_context import resolve_request_id
from app.schemas import (
    BatchPredictItemResult,
    BatchPredictRequest,
    BatchPredictResponse,
    ExplainRequest,
    ExplainResponse,
    HealthResponse,
    ModelInfo,
    ModelInfoResponse,
    PredictRequest,
    PredictResponse,
    QualityChecks,
    ReadyResponse,
    ValidateImageRequest,
    ValidateImageResponse,
)

configure_json_logging(level=logging.INFO)
logger = logging.getLogger("mboyo.ml_api")

_model_loaded_at: datetime | None = None


def _service_version() -> str:
    try:
        return version("mboyo-ml-api")
    except PackageNotFoundError:
        return "0.1.0"


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    global _model_loaded_at
    settings = get_settings()
    init_sentry(settings)
    registry = ModelRegistry(settings.model_artifact_dir)
    registry.load()
    if registry.is_ready:
        _model_loaded_at = datetime.now(UTC)
        logger.info("model loaded", extra={"model_artifact_dir": str(settings.model_artifact_dir)})
    else:
        logger.warning(
            "no model loaded at startup",
            extra={"reason": registry.load_error, "demo_mode": settings.demo_mode},
        )
    app.state.model_registry = registry
    app.state.rate_limiter = RateLimiter(settings.rate_limit_requests_per_minute)
    yield


app = FastAPI(title="MBOYO ML API", version="0.1.0", lifespan=lifespan)
app.add_middleware(StrictOriginMiddleware)


def _get_registry(request: Request) -> ModelRegistry:
    registry: ModelRegistry = request.app.state.model_registry
    return registry


def _get_rate_limiter(request: Request) -> RateLimiter:
    limiter: RateLimiter = request.app.state.rate_limiter
    return limiter


def _enforce_rate_limit(request: Request, request_id: str) -> None:
    limiter = _get_rate_limiter(request)
    client_key = request.client.host if request.client else "unknown"
    if not limiter.allow(client_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": "rate_limited",
                "message": "Too many requests.",
                "requestId": request_id,
            },
        )


def _model_info_from_registry(registry: ModelRegistry, settings: Settings) -> ModelInfo:
    if registry.is_ready:
        loaded = registry.require_loaded()
        return ModelInfo(
            version=loaded.version,
            architecture=loaded.architecture,
            checksum=loaded.checksum,
            preprocessing_version=PREPROCESSING_VERSION,
            is_advisory_only=loaded.is_advisory_only,
        )
    return ModelInfo(
        version="demo-fallback" if settings.demo_mode else "none",
        architecture="none",
        checksum="",
        preprocessing_version=PREPROCESSING_VERSION,
        is_advisory_only=True,
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Structured error envelope for every HTTPException — mirrors
    apps/web's { ok: false, error: { code, message }, requestId } shape
    (lib/api/result.ts) so both languages' error bodies are shaped the same
    way, per this block's "structured errors" requirement."""
    request_id = request.headers.get("x-request-id") or "unknown"
    detail = exc.detail
    if isinstance(detail, dict) and "code" in detail:
        code = str(detail["code"])
        message = str(detail.get("message", ""))
        request_id = str(detail.get("requestId", request_id))
    else:
        code = "error"
        message = str(detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"ok": False, "error": {"code": code, "message": message}, "requestId": request_id},
    )


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="apps/ml-api",
        version=_service_version(),
        timestamp=datetime.now(UTC),
    )


@app.get("/ready", response_model=ReadyResponse)
def ready(
    request: Request,
    request_id: str = Depends(resolve_request_id),
    settings: Settings = Depends(get_settings),
    _: None = Depends(require_internal_token),
) -> ReadyResponse:
    registry = _get_registry(request)
    if registry.is_ready:
        return ReadyResponse(ready=True, reason=None, request_id=request_id)
    if settings.demo_mode:
        return ReadyResponse(
            ready=True,
            reason="No model loaded — serving DEMO_MODE deterministic fallback only.",
            request_id=request_id,
        )
    return ReadyResponse(
        ready=False,
        reason=registry.load_error or "Model has not finished loading.",
        request_id=request_id,
    )


@app.get("/model-info", response_model=ModelInfoResponse)
def model_info(
    request: Request,
    request_id: str = Depends(resolve_request_id),
    settings: Settings = Depends(get_settings),
    _: None = Depends(require_internal_token),
) -> ModelInfoResponse:
    registry = _get_registry(request)
    info = _model_info_from_registry(registry, settings)
    loaded_at = _model_loaded_at or datetime.now(UTC)
    return ModelInfoResponse(model=info, loaded_at=loaded_at, request_id=request_id)


@app.post("/validate-image", response_model=ValidateImageResponse)
def validate_image(
    body: ValidateImageRequest,
    request: Request,
    request_id: str = Depends(resolve_request_id),
    _: None = Depends(require_internal_token),
) -> ValidateImageResponse:
    _enforce_rate_limit(request, request_id)
    try:
        _raw_bytes, image = decode_image(body.image_base64, body.mime_type)
    except ImageDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "image_decode_failed", "message": str(exc), "requestId": request_id},
        ) from exc

    quality = check_quality(image)
    return ValidateImageResponse(
        valid=quality.passed,
        quality_score=quality.quality_score,
        reasons=list(quality.reasons),
        request_id=request_id,
    )


@app.post("/predict", response_model=PredictResponse)
def predict(
    body: PredictRequest,
    request: Request,
    request_id: str = Depends(resolve_request_id),
    settings: Settings = Depends(get_settings),
    _: None = Depends(require_internal_token),
) -> PredictResponse:
    _enforce_rate_limit(request, request_id)
    registry = _get_registry(request)

    try:
        raw_bytes, image = decode_image(body.image_base64, body.mime_type)
    except ImageDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "image_decode_failed", "message": str(exc), "requestId": request_id},
        ) from exc

    model = registry.require_loaded() if registry.is_ready else None
    if model is None and not settings.demo_mode:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "model_not_loaded",
                "message": "No trained model is loaded and DEMO_MODE is disabled.",
                "requestId": request_id,
            },
        )

    result = run_prediction(model, raw_bytes, image, settings.demo_mode)

    model_info_value = _model_info_from_registry(registry, settings)

    return PredictResponse(
        prediction=result.prediction,
        calibrated_probabilities=result.calibrated_probabilities,
        confidence=result.confidence,
        entropy=result.entropy,
        abstained=result.abstained,
        abstention_reasons=list(result.abstention_reasons),
        quality_checks=QualityChecks(
            quality_score=result.quality.quality_score,
            passed=result.quality.passed,
            reasons=list(result.quality.reasons),
        ),
        model=model_info_value,
        latency_ms=result.latency_ms,
        explanation_ref=None,
        disclaimer=result.disclaimer,
        is_demo_fallback=result.is_demo_fallback,
        request_id=request_id,
    )


@app.post("/explain", response_model=ExplainResponse)
def explain(
    body: ExplainRequest,
    request: Request,
    request_id: str = Depends(resolve_request_id),
    settings: Settings = Depends(get_settings),
    _: None = Depends(require_internal_token),
) -> ExplainResponse:
    _enforce_rate_limit(request, request_id)
    registry = _get_registry(request)

    if not registry.is_ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "model_not_loaded",
                "message": "No trained model is loaded — cannot generate an explanation.",
                "requestId": request_id,
            },
        )

    try:
        _raw_bytes, image = decode_image(body.image_base64, body.mime_type)
    except ImageDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "image_decode_failed", "message": str(exc), "requestId": request_id},
        ) from exc

    model = registry.require_loaded()
    target_index = model.classes.index(body.target_class) if body.target_class else None

    start = time.perf_counter()
    preprocessed = preprocess_for_model(image, model.preprocessing)
    sensitivity_map = compute_occlusion_sensitivity(model, preprocessed, target_index)
    heatmap_base64 = render_heatmap_overlay_png_base64(image, sensitivity_map)
    latency_ms = (time.perf_counter() - start) * 1000

    model_info_value = _model_info_from_registry(registry, settings)

    return ExplainResponse(
        heatmap_png_base64=heatmap_base64,
        target_class=model.classes[sensitivity_map.target_class_index],
        disclaimer=(
            "This heatmap shows which coarse image regions most affect the model's "
            "predicted probability when occluded (occlusion-based sensitivity, not "
            "Grad-CAM) — it is a correlational visualization, not a causal "
            "explanation. A highlighted region is not proof of damage and does not "
            "indicate the prediction is correct."
        ),
        model=model_info_value,
        latency_ms=latency_ms,
        request_id=request_id,
    )


@app.post("/batch-predict", response_model=BatchPredictResponse)
def batch_predict(
    body: BatchPredictRequest,
    request: Request,
    request_id: str = Depends(resolve_request_id),
    settings: Settings = Depends(get_settings),
    _: None = Depends(require_internal_token),
) -> BatchPredictResponse:
    """Internal-only (apps/worker) batch variant — never intended for
    apps/web/browser callers, gated the same way (internal token) but
    documented as internal-only per this block's explicit requirement."""
    _enforce_rate_limit(request, request_id)
    registry = _get_registry(request)
    model = registry.require_loaded() if registry.is_ready else None

    if model is None and not settings.demo_mode:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "model_not_loaded",
                "message": "No trained model is loaded and DEMO_MODE is disabled.",
                "requestId": request_id,
            },
        )

    model_info_value = _model_info_from_registry(registry, settings)
    results: list[BatchPredictItemResult] = []

    for item in body.items:
        try:
            raw_bytes, image = decode_image(item.image_base64, item.mime_type)
        except ImageDecodeError as exc:
            results.append(
                BatchPredictItemResult(ok=False, report_id=item.report_id, error=str(exc))
            )
            continue

        result = run_prediction(model, raw_bytes, image, settings.demo_mode)
        results.append(
            BatchPredictItemResult(
                ok=True,
                report_id=item.report_id,
                result=PredictResponse(
                    prediction=result.prediction,
                    calibrated_probabilities=result.calibrated_probabilities,
                    confidence=result.confidence,
                    entropy=result.entropy,
                    abstained=result.abstained,
                    abstention_reasons=list(result.abstention_reasons),
                    quality_checks=QualityChecks(
                        quality_score=result.quality.quality_score,
                        passed=result.quality.passed,
                        reasons=list(result.quality.reasons),
                    ),
                    model=model_info_value,
                    latency_ms=result.latency_ms,
                    explanation_ref=None,
                    disclaimer=result.disclaimer,
                    is_demo_fallback=result.is_demo_fallback,
                    request_id=request_id,
                ),
            )
        )

    return BatchPredictResponse(results=results, request_id=request_id)
