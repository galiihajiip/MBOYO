"""Shared response schemas for apps/ml-api.

Every schema here mirrors a Zod schema in packages/domain/src/ (health.ts
for HealthResponse, ml.ts for everything else) field-for-field — keep both
languages in lockstep whenever one changes.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    service: str
    version: str
    timestamp: datetime


class ReadyResponse(BaseModel):
    ready: bool
    reason: str | None
    request_id: str = Field(serialization_alias="requestId")

    model_config = {"populate_by_name": True}


class ModelInfo(BaseModel):
    version: str
    architecture: str
    checksum: str
    preprocessing_version: str = Field(serialization_alias="preprocessingVersion")
    is_advisory_only: bool = Field(serialization_alias="isAdvisoryOnly")

    model_config = {"populate_by_name": True}


class ModelInfoResponse(BaseModel):
    model: ModelInfo
    loaded_at: datetime = Field(serialization_alias="loadedAt")
    request_id: str = Field(serialization_alias="requestId")

    model_config = {"populate_by_name": True}


class ValidateImageRequest(BaseModel):
    image_base64: str = Field(alias="imageBase64", min_length=1)
    mime_type: str = Field(alias="mimeType", min_length=1)

    model_config = {"populate_by_name": True}


class ValidateImageResponse(BaseModel):
    valid: bool
    quality_score: float = Field(serialization_alias="qualityScore", ge=0, le=1)
    reasons: list[str]
    request_id: str = Field(serialization_alias="requestId")

    model_config = {"populate_by_name": True}


class PredictRequest(BaseModel):
    report_id: str = Field(alias="reportId")
    image_base64: str = Field(alias="imageBase64", min_length=1)
    mime_type: str = Field(alias="mimeType", min_length=1)

    model_config = {"populate_by_name": True}


class QualityChecks(BaseModel):
    quality_score: float = Field(serialization_alias="qualityScore", ge=0, le=1)
    passed: bool
    reasons: list[str]

    model_config = {"populate_by_name": True}


class PredictResponse(BaseModel):
    prediction: str
    calibrated_probabilities: dict[str, float] = Field(
        serialization_alias="calibratedProbabilities"
    )
    confidence: float = Field(ge=0, le=1)
    entropy: float = Field(ge=0)
    abstained: bool
    abstention_reasons: list[str] = Field(serialization_alias="abstentionReasons")
    quality_checks: QualityChecks = Field(serialization_alias="qualityChecks")
    model: ModelInfo
    latency_ms: float = Field(serialization_alias="latencyMs", ge=0)
    explanation_ref: str | None = Field(serialization_alias="explanationRef")
    disclaimer: str
    is_demo_fallback: bool = Field(serialization_alias="isDemoFallback")
    request_id: str = Field(serialization_alias="requestId")

    model_config = {"populate_by_name": True}


class ExplainRequest(BaseModel):
    report_id: str = Field(alias="reportId")
    image_base64: str = Field(alias="imageBase64", min_length=1)
    mime_type: str = Field(alias="mimeType", min_length=1)
    target_class: str | None = Field(default=None, alias="targetClass")

    model_config = {"populate_by_name": True}


class ExplainResponse(BaseModel):
    heatmap_png_base64: str = Field(serialization_alias="heatmapPngBase64")
    target_class: str = Field(serialization_alias="targetClass")
    disclaimer: str
    model: ModelInfo
    latency_ms: float = Field(serialization_alias="latencyMs", ge=0)
    request_id: str = Field(serialization_alias="requestId")

    model_config = {"populate_by_name": True}


class BatchPredictRequest(BaseModel):
    items: list[PredictRequest] = Field(min_length=1, max_length=16)

    model_config = {"populate_by_name": True}


class BatchPredictItemResult(BaseModel):
    ok: bool
    report_id: str = Field(serialization_alias="reportId")
    result: PredictResponse | None = None
    error: str | None = None

    model_config = {"populate_by_name": True}


class BatchPredictResponse(BaseModel):
    results: list[BatchPredictItemResult]
    request_id: str = Field(serialization_alias="requestId")

    model_config = {"populate_by_name": True}


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    ok: Literal[False] = False
    error: ErrorDetail
    request_id: str = Field(serialization_alias="requestId")

    model_config = {"populate_by_name": True}
