from __future__ import annotations

import json

import httpx
import pytest

from worker.supabase_client import SupabaseClient, SupabaseRequestError


def _client_with_transport(handler: httpx.MockTransport) -> SupabaseClient:
    async_client = httpx.AsyncClient(transport=handler)
    return SupabaseClient(
        "https://example.supabase.co", "service-role-key", "report-evidence", client=async_client
    )


@pytest.mark.asyncio
async def test_call_rpc_sends_service_role_headers_and_returns_json() -> None:
    captured: dict[str, httpx.Request] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["request"] = request
        return httpx.Response(200, json=[{"id": "job-1", "report_id": "report-1", "attempts": 1}])

    client = _client_with_transport(httpx.MockTransport(handler))
    result = await client.call_rpc("claim_analysis_jobs", {"worker_id": "w1", "batch_size": 1})

    assert result == [{"id": "job-1", "report_id": "report-1", "attempts": 1}]
    request = captured["request"]
    assert request.url.path == "/rest/v1/rpc/claim_analysis_jobs"
    assert request.headers["apikey"] == "service-role-key"
    assert request.headers["Authorization"] == "Bearer service-role-key"
    body = json.loads(request.content)
    assert body == {"worker_id": "w1", "batch_size": 1}


@pytest.mark.asyncio
async def test_call_rpc_raises_on_error_status() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(409, text='{"code": "23505"}')

    client = _client_with_transport(httpx.MockTransport(handler))
    with pytest.raises(SupabaseRequestError) as exc_info:
        await client.call_rpc("record_analysis_result", {})

    assert exc_info.value.status_code == 409
    assert "23505" in exc_info.value.body


@pytest.mark.asyncio
async def test_select_one_returns_first_row_or_none() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[{"id": "evidence-1", "storage_path": "r/hash"}])

    client = _client_with_transport(httpx.MockTransport(handler))
    row = await client.select_one("report_evidence", {"report_id": "eq.report-1"})
    assert row == {"id": "evidence-1", "storage_path": "r/hash"}


@pytest.mark.asyncio
async def test_select_one_returns_none_for_empty_result() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[])

    client = _client_with_transport(httpx.MockTransport(handler))
    row = await client.select_one("report_evidence", {"report_id": "eq.missing"})
    assert row is None


@pytest.mark.asyncio
async def test_download_evidence_returns_raw_bytes() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert "report-evidence" in request.url.path
        return httpx.Response(200, content=b"fake-image-bytes")

    client = _client_with_transport(httpx.MockTransport(handler))
    content = await client.download_evidence("report-1/somehash")
    assert content == b"fake-image-bytes"


@pytest.mark.asyncio
async def test_download_evidence_raises_on_error() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, text="not found")

    client = _client_with_transport(httpx.MockTransport(handler))
    with pytest.raises(SupabaseRequestError) as exc_info:
        await client.download_evidence("report-1/missing")
    assert exc_info.value.status_code == 404
