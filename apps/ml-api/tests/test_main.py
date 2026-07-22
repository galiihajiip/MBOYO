from __future__ import annotations

import base64
import io
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from .test_model_registry import _write_valid_artifact

INTERNAL_TOKEN = "test-internal-token"


def _image_base64(width: int = 300, height: int = 300) -> str:
    image = Image.new("RGB", (width, height))
    pixels = image.load()
    assert pixels is not None
    for y in range(height):
        for x in range(width):
            pixels[x, y] = ((x * 7) % 256, (y * 13) % 256, ((x + y) * 3) % 256)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


@pytest.fixture
def auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {INTERNAL_TOKEN}"}


@pytest.fixture
def client_without_model(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Iterator[TestClient]:
    monkeypatch.setenv("ML_INTERNAL_TOKEN", INTERNAL_TOKEN)
    monkeypatch.setenv("DEMO_MODE", "true")
    monkeypatch.setenv("MODEL_ARTIFACT_DIR", str(tmp_path))

    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def client_with_model(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Iterator[TestClient]:
    _write_valid_artifact(tmp_path)
    monkeypatch.setenv("ML_INTERNAL_TOKEN", INTERNAL_TOKEN)
    monkeypatch.setenv("DEMO_MODE", "false")
    monkeypatch.setenv("MODEL_ARTIFACT_DIR", str(tmp_path))

    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


def test_health_requires_no_token(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("ML_INTERNAL_TOKEN", INTERNAL_TOKEN)
    monkeypatch.setenv("MODEL_ARTIFACT_DIR", str(tmp_path))

    from app.main import app

    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


def test_ready_requires_internal_token(client_with_model: TestClient) -> None:
    response = client_with_model.get("/ready")
    assert response.status_code == 401


def test_ready_reports_true_once_model_is_loaded(
    client_with_model: TestClient, auth_headers: dict[str, str]
) -> None:
    response = client_with_model.get("/ready", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["ready"] is True
    assert response.json()["reason"] is None


def test_ready_reports_true_with_caveat_in_demo_mode_without_a_model(
    client_without_model: TestClient, auth_headers: dict[str, str]
) -> None:
    response = client_without_model.get("/ready", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["ready"] is True
    assert "DEMO_MODE" in body["reason"]


def test_model_info_reflects_the_loaded_model(
    client_with_model: TestClient, auth_headers: dict[str, str]
) -> None:
    response = client_with_model.get("/model-info", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["model"]["version"] == "v1"
    assert body["model"]["architecture"] == "trivial-test-model"
    assert body["model"]["isAdvisoryOnly"] is False


def test_validate_image_reports_quality_issues(
    client_with_model: TestClient, auth_headers: dict[str, str]
) -> None:
    flat_image = Image.new("RGB", (300, 300), (128, 128, 128))
    buffer = io.BytesIO()
    flat_image.save(buffer, format="JPEG")
    image_b64 = base64.b64encode(buffer.getvalue()).decode("ascii")

    response = client_with_model.post(
        "/validate-image",
        json={"imageBase64": image_b64, "mimeType": "image/jpeg"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["valid"] is False
    assert len(body["reasons"]) > 0


def test_predict_returns_a_full_shaped_response(
    client_with_model: TestClient, auth_headers: dict[str, str]
) -> None:
    response = client_with_model.post(
        "/predict",
        json={
            "reportId": "11111111-1111-1111-1111-111111111111",
            "imageBase64": _image_base64(),
            "mimeType": "image/jpeg",
        },
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["prediction"] in {
        "unknown",
        "no_damage",
        "minor_damage",
        "major_damage",
        "destroyed",
    }
    assert abs(sum(body["calibratedProbabilities"].values()) - 1.0) < 1e-6
    assert body["isDemoFallback"] is False
    assert "requestId" in body
    assert body["disclaimer"]


def test_predict_falls_back_deterministically_in_demo_mode_without_a_model(
    client_without_model: TestClient, auth_headers: dict[str, str]
) -> None:
    response = client_without_model.post(
        "/predict",
        json={
            "reportId": "11111111-1111-1111-1111-111111111111",
            "imageBase64": _image_base64(),
            "mimeType": "image/jpeg",
        },
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["isDemoFallback"] is True
    assert "DEMO_MODE" in body["disclaimer"]


def test_predict_rejects_an_undecodable_image(
    client_with_model: TestClient, auth_headers: dict[str, str]
) -> None:
    response = client_with_model.post(
        "/predict",
        json={
            "reportId": "11111111-1111-1111-1111-111111111111",
            "imageBase64": "not-valid-base64!!!",
            "mimeType": "image/jpeg",
        },
        headers=auth_headers,
    )
    assert response.status_code == 400
    body = response.json()
    assert body["ok"] is False
    assert body["error"]["code"] == "image_decode_failed"
    assert "requestId" in body


def test_explain_returns_a_heatmap(
    client_with_model: TestClient, auth_headers: dict[str, str]
) -> None:
    response = client_with_model.post(
        "/explain",
        json={
            "reportId": "11111111-1111-1111-1111-111111111111",
            "imageBase64": _image_base64(),
            "mimeType": "image/jpeg",
        },
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["heatmapPngBase64"]) > 0
    assert "Grad-CAM" in body["disclaimer"] or "occlusion" in body["disclaimer"].lower()


def test_batch_predict_processes_multiple_items(
    client_with_model: TestClient, auth_headers: dict[str, str]
) -> None:
    response = client_with_model.post(
        "/batch-predict",
        json={
            "items": [
                {
                    "reportId": "11111111-1111-1111-1111-111111111111",
                    "imageBase64": _image_base64(),
                    "mimeType": "image/jpeg",
                },
                {
                    "reportId": "22222222-2222-2222-2222-222222222222",
                    "imageBase64": _image_base64(width=250, height=250),
                    "mimeType": "image/jpeg",
                },
            ]
        },
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["results"]) == 2
    assert all(item["ok"] for item in body["results"])


def test_origin_header_is_rejected(client_with_model: TestClient) -> None:
    response = client_with_model.get("/health", headers={"Origin": "https://example.com"})
    assert response.status_code == 403


def test_wrong_internal_token_is_rejected(client_with_model: TestClient) -> None:
    response = client_with_model.get("/ready", headers={"Authorization": "Bearer wrong-token"})
    assert response.status_code == 401
