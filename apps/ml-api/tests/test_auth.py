from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.auth import require_internal_token
from app.config import Settings


def _settings(**overrides: object) -> Settings:
    base: dict[str, object] = {"ml_internal_token": "secret-token"}
    base.update(overrides)
    return Settings(**base)  # type: ignore[arg-type]


def test_valid_token_passes() -> None:
    settings = _settings()
    # require_internal_token raises on failure and returns None on success —
    # simply not raising IS the pass condition here.
    require_internal_token(authorization="Bearer secret-token", settings=settings)


def test_missing_token_raises_401() -> None:
    settings = _settings()
    with pytest.raises(HTTPException) as exc_info:
        require_internal_token(authorization=None, settings=settings)
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Invalid or missing internal token."


def test_wrong_token_raises_401() -> None:
    settings = _settings()
    with pytest.raises(HTTPException) as exc_info:
        require_internal_token(authorization="Bearer wrong-token", settings=settings)
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Invalid or missing internal token."


def test_token_without_bearer_prefix_is_rejected() -> None:
    settings = _settings()
    with pytest.raises(HTTPException) as exc_info:
        require_internal_token(authorization="secret-token", settings=settings)
    assert exc_info.value.status_code == 401


def test_unconfigured_token_fails_closed_with_503() -> None:
    settings = Settings.model_construct(ml_internal_token="")
    with pytest.raises(HTTPException) as exc_info:
        require_internal_token(authorization="Bearer anything", settings=settings)
    assert exc_info.value.status_code == 503
    assert "ML_INTERNAL_TOKEN is not configured" in str(exc_info.value.detail)
