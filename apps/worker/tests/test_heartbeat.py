from __future__ import annotations

from datetime import datetime
from typing import Any

import pytest

from worker.heartbeat import heartbeat


@pytest.mark.asyncio
async def test_heartbeat_yields_a_utc_datetime_each_iteration(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sleep_calls: list[float] = []

    async def fake_sleep(seconds: float) -> None:
        sleep_calls.append(seconds)

    monkeypatch.setattr("worker.heartbeat.asyncio.sleep", fake_sleep)

    results: list[datetime] = []
    async for tick in heartbeat(10.0):
        results.append(tick)
        if len(results) == 3:
            break

    assert len(results) == 3
    assert all(tick.tzinfo is not None for tick in results)
    # The generator sleeps *after* each yield, so breaking out after the 3rd
    # yield means exactly 2 sleeps happened by that point (the loop body
    # after the 3rd yield/sleep is never reached because the consumer broke
    # out of the `async for` before requesting a 4th value).
    assert sleep_calls == [10.0, 10.0]


@pytest.mark.asyncio
async def test_heartbeat_sleeps_for_the_given_interval_each_time(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sleep_calls: list[float] = []

    async def fake_sleep(seconds: float) -> None:
        sleep_calls.append(seconds)

    monkeypatch.setattr("worker.heartbeat.asyncio.sleep", fake_sleep)

    count = 0
    async for _tick in heartbeat(0.5):
        count += 1
        if count == 5:
            break

    assert sleep_calls == [0.5, 0.5, 0.5, 0.5]


@pytest.mark.asyncio
async def test_heartbeat_logs_each_tick(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    async def fake_sleep(seconds: float) -> None:
        return None

    monkeypatch.setattr("worker.heartbeat.asyncio.sleep", fake_sleep)

    with caplog.at_level("INFO", logger="mboyo.worker.heartbeat"):
        count = 0
        async for _tick in heartbeat(1.0):
            count += 1
            if count == 2:
                break

    messages = [record.message for record in caplog.records]
    assert messages.count("worker heartbeat") == 2


@pytest.mark.asyncio
async def test_heartbeat_can_be_stopped_via_aclose(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_sleep(seconds: float) -> None:
        return None

    monkeypatch.setattr("worker.heartbeat.asyncio.sleep", fake_sleep)

    generator: Any = heartbeat(1.0)
    first = await generator.__anext__()
    assert first.tzinfo is not None

    await generator.aclose()

    with pytest.raises(StopAsyncIteration):
        await generator.__anext__()
