from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from app.config import Settings
from app.observability import init_sentry


def _settings(**overrides: object) -> Settings:
    base: dict[str, object] = {"ml_internal_token": "secret-token"}
    base.update(overrides)
    return Settings(**base)  # type: ignore[arg-type]


def test_is_a_no_op_when_sentry_dsn_is_none(monkeypatch: pytest.MonkeyPatch) -> None:
    mock_init = MagicMock()
    monkeypatch.setattr("app.observability.sentry_sdk.init", mock_init)

    init_sentry(_settings(sentry_dsn=None))

    mock_init.assert_not_called()


def test_calls_sentry_init_with_expected_args_when_dsn_is_set(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    mock_init = MagicMock()
    monkeypatch.setattr("app.observability.sentry_sdk.init", mock_init)

    dsn = "https://example@sentry.example.com/1"
    init_sentry(_settings(sentry_dsn=dsn))

    mock_init.assert_called_once_with(
        dsn=dsn,
        traces_sample_rate=0.1,
        send_default_pii=False,
    )
