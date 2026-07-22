from __future__ import annotations

import pytest

from app.rate_limit import RateLimiter


def test_allows_up_to_the_configured_limit_per_window() -> None:
    limiter = RateLimiter(requests_per_minute=3)
    assert limiter.allow("client-a") is True
    assert limiter.allow("client-a") is True
    assert limiter.allow("client-a") is True


def test_denies_the_request_immediately_after_the_limit_is_reached() -> None:
    limiter = RateLimiter(requests_per_minute=3)
    assert limiter.allow("client-a") is True
    assert limiter.allow("client-a") is True
    assert limiter.allow("client-a") is True
    assert limiter.allow("client-a") is False


def test_resets_after_the_window_elapses(monkeypatch: pytest.MonkeyPatch) -> None:
    current_time = 1000.0

    def fake_monotonic() -> float:
        return current_time

    monkeypatch.setattr("app.rate_limit.time.monotonic", fake_monotonic)

    limiter = RateLimiter(requests_per_minute=1)
    assert limiter.allow("client-a") is True
    assert limiter.allow("client-a") is False

    current_time += 60.0001
    assert limiter.allow("client-a") is True


def test_tracks_separate_keys_independently() -> None:
    limiter = RateLimiter(requests_per_minute=1)
    assert limiter.allow("client-a") is True
    assert limiter.allow("client-b") is True
    assert limiter.allow("client-a") is False
    assert limiter.allow("client-b") is False


def test_partial_window_expiry_only_evicts_entries_older_than_the_window(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    current_time = 0.0

    def fake_monotonic() -> float:
        return current_time

    monkeypatch.setattr("app.rate_limit.time.monotonic", fake_monotonic)

    limiter = RateLimiter(requests_per_minute=2)
    assert limiter.allow("client-a") is True  # t=0

    current_time = 30.0
    assert limiter.allow("client-a") is True  # t=30, still within window of t=0 entry

    current_time = 61.0
    # t=0 entry is now outside the 60s window (61 - 60 = 1 > 0), t=30 entry is not.
    assert limiter.allow("client-a") is True  # slot freed by expiry of t=0 entry
    assert limiter.allow("client-a") is False  # t=30 and t=61 entries both still active
