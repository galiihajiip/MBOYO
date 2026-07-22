from __future__ import annotations

from typing import Any

import pytest

from worker.config import Settings
from worker.observability import init_sentry


def _settings(**overrides: Any) -> Settings:
    # supabase_url has alias="NEXT_PUBLIC_SUPABASE_URL" (see config.py), and
    # pydantic-settings validates by alias, not the Python field name, when
    # constructing directly from kwargs.
    base: dict[str, Any] = {
        "database_url": "postgresql://user:pass@localhost:5432/mboyo",
        "NEXT_PUBLIC_SUPABASE_URL": "https://example.supabase.co",
        "supabase_service_role_key": "service-role-key",
        "ml_internal_token": "internal-token",
    }
    base.update(overrides)
    return Settings(**base)


def test_init_sentry_is_a_no_op_when_dsn_is_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[dict[str, Any]] = []

    def fake_init(**kwargs: Any) -> None:
        calls.append(kwargs)

    monkeypatch.setattr("worker.observability.sentry_sdk.init", fake_init)

    init_sentry(_settings(sentry_dsn=None))

    assert calls == []


def test_init_sentry_calls_sentry_sdk_init_when_dsn_is_set(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, Any]] = []

    def fake_init(**kwargs: Any) -> None:
        calls.append(kwargs)

    monkeypatch.setattr("worker.observability.sentry_sdk.init", fake_init)

    init_sentry(_settings(sentry_dsn="https://examplekey@o0.ingest.sentry.io/0"))

    assert len(calls) == 1
    assert calls[0]["dsn"] == "https://examplekey@o0.ingest.sentry.io/0"
    assert calls[0]["traces_sample_rate"] == 0.1
    assert calls[0]["send_default_pii"] is False


def test_init_sentry_is_a_no_op_when_dsn_is_empty_string(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[dict[str, Any]] = []

    def fake_init(**kwargs: Any) -> None:
        calls.append(kwargs)

    monkeypatch.setattr("worker.observability.sentry_sdk.init", fake_init)

    init_sentry(_settings(sentry_dsn=""))

    assert calls == []
