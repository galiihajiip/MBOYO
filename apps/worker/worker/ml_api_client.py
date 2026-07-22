"""Typed HTTP client for apps/ml-api, called from apps/worker's job
processing loop. Sends `Authorization: Bearer <ML_INTERNAL_TOKEN>` on every
call (the same internal-token mechanism apps/ml-api/app/auth.py verifies)
and propagates a correlation ID via the `x-request-id` header — minted
once per job (see worker/processing.py) and reused across every ml-api call
for that job, so a single job's ml-api calls are traceable together in
structured logs.
"""

from __future__ import annotations

import base64
from dataclasses import dataclass
from typing import Any

import httpx


class MlApiError(RuntimeError):
    def __init__(self, message: str, status_code: int, body: dict[str, Any] | None) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.body = body


@dataclass(frozen=True)
class PredictResult:
    prediction: str
    calibrated_probabilities: dict[str, float]
    confidence: float
    entropy: float
    abstained: bool
    abstention_reasons: tuple[str, ...]
    quality_score: float
    quality_passed: bool
    model_version: str
    model_checksum: str
    is_advisory_only: bool
    is_demo_fallback: bool
    disclaimer: str
    latency_ms: float


@dataclass(frozen=True)
class ExplainResult:
    heatmap_png_base64: str
    target_class: str
    disclaimer: str


class MlApiClient:
    def __init__(
        self, base_url: str, internal_token: str, client: httpx.AsyncClient | None = None
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._internal_token = internal_token
        self._client = client or httpx.AsyncClient(timeout=60.0)

    def _headers(self, request_id: str) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._internal_token}",
            "Content-Type": "application/json",
            "x-request-id": request_id,
        }

    async def _post(self, path: str, payload: dict[str, Any], request_id: str) -> dict[str, Any]:
        response = await self._client.post(
            f"{self._base_url}{path}", headers=self._headers(request_id), json=payload
        )
        body: dict[str, Any] | None
        try:
            body = response.json()
        except ValueError:
            body = None

        if response.status_code >= 400:
            message = f"apps/ml-api {path} failed with status {response.status_code}"
            raise MlApiError(message, response.status_code, body)

        assert body is not None
        return body

    async def predict(
        self, report_id: str, image_bytes: bytes, mime_type: str, request_id: str
    ) -> PredictResult:
        image_base64 = base64.b64encode(image_bytes).decode("ascii")
        body = await self._post(
            "/predict",
            {"reportId": report_id, "imageBase64": image_base64, "mimeType": mime_type},
            request_id,
        )
        return PredictResult(
            prediction=body["prediction"],
            calibrated_probabilities=body["calibratedProbabilities"],
            confidence=body["confidence"],
            entropy=body["entropy"],
            abstained=body["abstained"],
            abstention_reasons=tuple(body["abstentionReasons"]),
            quality_score=body["qualityChecks"]["qualityScore"],
            quality_passed=body["qualityChecks"]["passed"],
            model_version=body["model"]["version"],
            model_checksum=body["model"]["checksum"],
            is_advisory_only=body["model"]["isAdvisoryOnly"],
            is_demo_fallback=body["isDemoFallback"],
            disclaimer=body["disclaimer"],
            latency_ms=body["latencyMs"],
        )

    async def explain(
        self, report_id: str, image_bytes: bytes, mime_type: str, target_class: str, request_id: str
    ) -> ExplainResult:
        image_base64 = base64.b64encode(image_bytes).decode("ascii")
        body = await self._post(
            "/explain",
            {
                "reportId": report_id,
                "imageBase64": image_base64,
                "mimeType": mime_type,
                "targetClass": target_class,
            },
            request_id,
        )
        return ExplainResult(
            heatmap_png_base64=body["heatmapPngBase64"],
            target_class=body["targetClass"],
            disclaimer=body["disclaimer"],
        )

    async def ready(self, request_id: str) -> bool:
        response = await self._client.get(
            f"{self._base_url}/ready", headers=self._headers(request_id)
        )
        if response.status_code >= 400:
            return False
        body: dict[str, Any] = response.json()
        return bool(body.get("ready", False))

    async def aclose(self) -> None:
        await self._client.aclose()
