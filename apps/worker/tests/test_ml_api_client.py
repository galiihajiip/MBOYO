from __future__ import annotations

import base64
import json

import httpx
import pytest

from worker.ml_api_client import MlApiClient, MlApiError

PREDICT_BODY = {
    "prediction": "minor_damage",
    "calibratedProbabilities": {
        "unknown": 0.1,
        "no_damage": 0.1,
        "minor_damage": 0.5,
        "major_damage": 0.2,
        "destroyed": 0.1,
    },
    "confidence": 0.5,
    "entropy": 1.2,
    "abstained": False,
    "abstentionReasons": [],
    "qualityChecks": {"qualityScore": 0.8, "passed": True, "reasons": []},
    "model": {
        "version": "v1",
        "architecture": "mobilenet_v3_large",
        "checksum": "abc123",
        "preprocessingVersion": "v1",
        "isAdvisoryOnly": False,
    },
    "latencyMs": 12.5,
    "explanationRef": None,
    "disclaimer": "disclaimer text",
    "isDemoFallback": False,
    "requestId": "req-1",
}


def _client_with_transport(handler: httpx.MockTransport) -> MlApiClient:
    async_client = httpx.AsyncClient(transport=handler)
    return MlApiClient("http://ml-api:8000", "internal-token", client=async_client)


@pytest.mark.asyncio
async def test_predict_sends_internal_token_and_request_id() -> None:
    captured: dict[str, httpx.Request] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["request"] = request
        return httpx.Response(200, json=PREDICT_BODY)

    client = _client_with_transport(httpx.MockTransport(handler))
    result = await client.predict("report-1", b"image-bytes", "image/jpeg", "req-1")

    request = captured["request"]
    assert request.headers["Authorization"] == "Bearer internal-token"
    assert request.headers["x-request-id"] == "req-1"
    body = json.loads(request.content)
    assert body["reportId"] == "report-1"
    assert body["imageBase64"] == base64.b64encode(b"image-bytes").decode("ascii")

    assert result.prediction == "minor_damage"
    assert result.confidence == 0.5
    assert result.is_advisory_only is False
    assert result.model_version == "v1"


@pytest.mark.asyncio
async def test_predict_raises_ml_api_error_on_failure_status() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, json={"ok": False, "error": {"code": "model_not_loaded"}})

    client = _client_with_transport(httpx.MockTransport(handler))
    with pytest.raises(MlApiError) as exc_info:
        await client.predict("report-1", b"image-bytes", "image/jpeg", "req-1")

    assert exc_info.value.status_code == 503
    assert exc_info.value.body is not None
    assert exc_info.value.body["error"]["code"] == "model_not_loaded"


@pytest.mark.asyncio
async def test_explain_returns_heatmap_result() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "heatmapPngBase64": "base64-png-data",
                "targetClass": "minor_damage",
                "disclaimer": "occlusion disclaimer",
                "model": PREDICT_BODY["model"],
                "latencyMs": 30.0,
                "requestId": "req-2",
            },
        )

    client = _client_with_transport(httpx.MockTransport(handler))
    result = await client.explain("report-1", b"image-bytes", "image/jpeg", "minor_damage", "req-2")

    assert result.heatmap_png_base64 == "base64-png-data"
    assert result.target_class == "minor_damage"


@pytest.mark.asyncio
async def test_ready_returns_false_on_non_2xx() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(503)

    client = _client_with_transport(httpx.MockTransport(handler))
    assert await client.ready("req-3") is False


@pytest.mark.asyncio
async def test_ready_returns_true_when_ready() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"ready": True, "reason": None, "requestId": "req-4"})

    client = _client_with_transport(httpx.MockTransport(handler))
    assert await client.ready("req-4") is True
