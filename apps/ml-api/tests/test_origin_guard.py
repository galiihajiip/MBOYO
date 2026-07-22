from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.origin_guard import StrictOriginMiddleware

INTERNAL_TOKEN = "test-internal-token"


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("ML_INTERNAL_TOKEN", INTERNAL_TOKEN)
    monkeypatch.setenv("ALLOWED_ORIGINS", '["https://allowed.example.com"]')

    app = FastAPI()
    app.add_middleware(StrictOriginMiddleware)

    @app.get("/probe")
    def probe() -> dict[str, bool]:
        return {"ok": True}

    with TestClient(app) as test_client:
        yield test_client


def test_request_with_no_origin_header_passes_through(client: TestClient) -> None:
    response = client.get("/probe")
    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_request_with_an_allowlisted_origin_passes_through(client: TestClient) -> None:
    response = client.get("/probe", headers={"Origin": "https://allowed.example.com"})
    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_request_with_a_non_allowlisted_origin_is_rejected(client: TestClient) -> None:
    response = client.get("/probe", headers={"Origin": "https://evil.example.com"})
    assert response.status_code == 403
    body = response.json()
    assert body["ok"] is False
    assert body["error"]["code"] == "origin_not_allowed"
    assert "requestId" in body
    assert body["requestId"] == "unknown"


def test_rejected_origin_response_echoes_the_inbound_request_id(client: TestClient) -> None:
    response = client.get(
        "/probe",
        headers={"Origin": "https://evil.example.com", "x-request-id": "req-123"},
    )
    assert response.status_code == 403
    assert response.json()["requestId"] == "req-123"


def test_empty_allowed_origins_rejects_every_browser_origin_request(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ML_INTERNAL_TOKEN", INTERNAL_TOKEN)
    monkeypatch.delenv("ALLOWED_ORIGINS", raising=False)

    app = FastAPI()
    app.add_middleware(StrictOriginMiddleware)

    @app.get("/probe")
    def probe() -> dict[str, bool]:
        return {"ok": True}

    with TestClient(app) as test_client:
        response = test_client.get("/probe", headers={"Origin": "https://anything.example.com"})
        assert response.status_code == 403
