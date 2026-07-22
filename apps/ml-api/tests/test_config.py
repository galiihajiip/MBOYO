from __future__ import annotations

from pathlib import Path

import pytest
from pydantic import ValidationError

from app.config import Settings, get_settings


def test_missing_required_field_raises_validation_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ML_INTERNAL_TOKEN", raising=False)
    with pytest.raises(ValidationError):
        Settings()  # type: ignore[call-arg]


def test_empty_required_field_raises_validation_error() -> None:
    with pytest.raises(ValidationError):
        Settings(ml_internal_token="")


def test_defaults_apply_when_only_the_required_field_is_given() -> None:
    settings = Settings(ml_internal_token="secret-token")
    assert settings.app_env == "development"
    assert settings.demo_mode is False
    assert settings.model_artifact_dir == Path("models")
    assert settings.allowed_origins == ()
    assert settings.rate_limit_requests_per_minute == 120
    assert settings.sentry_dsn is None


def test_sentry_dsn_env_var_maps_to_sentry_dsn_field(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ML_INTERNAL_TOKEN", "secret-token")
    monkeypatch.setenv("SENTRY_DSN", "https://example@sentry.example.com/1")

    settings = get_settings()
    assert settings.sentry_dsn == "https://example@sentry.example.com/1"


def test_get_settings_constructs_from_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ML_INTERNAL_TOKEN", "secret-token")
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DEMO_MODE", "true")
    monkeypatch.setenv("RATE_LIMIT_REQUESTS_PER_MINUTE", "42")

    settings = get_settings()
    assert settings.app_env == "production"
    assert settings.demo_mode is True
    assert settings.rate_limit_requests_per_minute == 42
