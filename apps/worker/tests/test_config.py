from __future__ import annotations

import pytest
from pydantic import ValidationError

from worker.config import Settings

REQUIRED_ENV: dict[str, str] = {
    "DATABASE_URL": "postgresql://user:pass@localhost:5432/mboyo",
    "NEXT_PUBLIC_SUPABASE_URL": "https://example.supabase.co",
    "SUPABASE_SERVICE_ROLE_KEY": "service-role-key",
    "ML_INTERNAL_TOKEN": "internal-token",
}


def _set_required_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for key, value in REQUIRED_ENV.items():
        monkeypatch.setenv(key, value)


def test_settings_constructs_from_required_env_vars(monkeypatch: pytest.MonkeyPatch) -> None:
    _set_required_env(monkeypatch)

    settings = Settings()  # type: ignore[call-arg]

    assert settings.database_url == REQUIRED_ENV["DATABASE_URL"]
    assert settings.supabase_url == REQUIRED_ENV["NEXT_PUBLIC_SUPABASE_URL"]
    assert settings.supabase_service_role_key == REQUIRED_ENV["SUPABASE_SERVICE_ROLE_KEY"]
    assert settings.ml_internal_token == REQUIRED_ENV["ML_INTERNAL_TOKEN"]


def test_settings_raises_validation_error_when_database_url_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("NEXT_PUBLIC_SUPABASE_URL", REQUIRED_ENV["NEXT_PUBLIC_SUPABASE_URL"])
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", REQUIRED_ENV["SUPABASE_SERVICE_ROLE_KEY"])
    monkeypatch.setenv("ML_INTERNAL_TOKEN", REQUIRED_ENV["ML_INTERNAL_TOKEN"])

    with pytest.raises(ValidationError) as exc_info:
        Settings()  # type: ignore[call-arg]

    assert "database_url" in str(exc_info.value)


def test_settings_raises_validation_error_when_supabase_url_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", REQUIRED_ENV["DATABASE_URL"])
    monkeypatch.delenv("NEXT_PUBLIC_SUPABASE_URL", raising=False)
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", REQUIRED_ENV["SUPABASE_SERVICE_ROLE_KEY"])
    monkeypatch.setenv("ML_INTERNAL_TOKEN", REQUIRED_ENV["ML_INTERNAL_TOKEN"])

    with pytest.raises(ValidationError) as exc_info:
        Settings()  # type: ignore[call-arg]

    # supabase_url has alias="NEXT_PUBLIC_SUPABASE_URL" (see config.py), so
    # pydantic reports the missing field under its env-var alias, not the
    # Python attribute name.
    assert "NEXT_PUBLIC_SUPABASE_URL" in str(exc_info.value)


def test_settings_raises_validation_error_when_service_role_key_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", REQUIRED_ENV["DATABASE_URL"])
    monkeypatch.setenv("NEXT_PUBLIC_SUPABASE_URL", REQUIRED_ENV["NEXT_PUBLIC_SUPABASE_URL"])
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    monkeypatch.setenv("ML_INTERNAL_TOKEN", REQUIRED_ENV["ML_INTERNAL_TOKEN"])

    with pytest.raises(ValidationError) as exc_info:
        Settings()  # type: ignore[call-arg]

    assert "supabase_service_role_key" in str(exc_info.value)


def test_settings_raises_validation_error_when_ml_internal_token_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", REQUIRED_ENV["DATABASE_URL"])
    monkeypatch.setenv("NEXT_PUBLIC_SUPABASE_URL", REQUIRED_ENV["NEXT_PUBLIC_SUPABASE_URL"])
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", REQUIRED_ENV["SUPABASE_SERVICE_ROLE_KEY"])
    monkeypatch.delenv("ML_INTERNAL_TOKEN", raising=False)

    with pytest.raises(ValidationError) as exc_info:
        Settings()  # type: ignore[call-arg]

    assert "ml_internal_token" in str(exc_info.value)


def test_settings_raises_validation_error_when_required_field_is_empty_string(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_required_env(monkeypatch)
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "")

    with pytest.raises(ValidationError) as exc_info:
        Settings()  # type: ignore[call-arg]

    assert "supabase_service_role_key" in str(exc_info.value)


def test_settings_applies_documented_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    _set_required_env(monkeypatch)
    monkeypatch.delenv("SUPABASE_REPORTS_BUCKET", raising=False)
    monkeypatch.delenv("ML_API_URL", raising=False)
    monkeypatch.delenv("HEARTBEAT_INTERVAL_SECONDS", raising=False)
    monkeypatch.delenv("CLAIM_BATCH_SIZE", raising=False)
    monkeypatch.delenv("CLAIM_POLL_INTERVAL_SECONDS", raising=False)
    monkeypatch.delenv("RECLAIM_SWEEP_INTERVAL_SECONDS", raising=False)
    monkeypatch.delenv("PROCESSING_LEASE_SECONDS", raising=False)
    monkeypatch.delenv("MAX_ATTEMPTS", raising=False)
    monkeypatch.delenv("SENTRY_DSN", raising=False)

    settings = Settings()  # type: ignore[call-arg]

    assert settings.supabase_reports_bucket == "report-evidence"
    assert settings.ml_api_url == "http://localhost:8000"
    assert settings.heartbeat_interval_seconds == 30.0
    assert settings.claim_batch_size == 1
    assert settings.claim_poll_interval_seconds == 5.0
    assert settings.reclaim_sweep_interval_seconds == 60.0
    assert settings.processing_lease_seconds == 300
    assert settings.max_attempts == 3
    assert settings.sentry_dsn is None
    # worker_id is generated per-instance rather than a fixed default.
    assert settings.worker_id.startswith("worker-")


def test_settings_generates_a_unique_worker_id_per_instance(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_required_env(monkeypatch)
    monkeypatch.delenv("WORKER_ID", raising=False)

    first = Settings()  # type: ignore[call-arg]
    second = Settings()  # type: ignore[call-arg]

    assert first.worker_id != second.worker_id


def test_settings_maps_sentry_dsn_env_var(monkeypatch: pytest.MonkeyPatch) -> None:
    _set_required_env(monkeypatch)
    monkeypatch.setenv("SENTRY_DSN", "https://examplekey@o0.ingest.sentry.io/0")

    settings = Settings()  # type: ignore[call-arg]

    assert settings.sentry_dsn == "https://examplekey@o0.ingest.sentry.io/0"


def test_settings_overrides_defaults_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    _set_required_env(monkeypatch)
    monkeypatch.setenv("CLAIM_BATCH_SIZE", "5")
    monkeypatch.setenv("MAX_ATTEMPTS", "7")
    monkeypatch.setenv("WORKER_ID", "worker-fixed")

    settings = Settings()  # type: ignore[call-arg]

    assert settings.claim_batch_size == 5
    assert settings.max_attempts == 7
    assert settings.worker_id == "worker-fixed"
