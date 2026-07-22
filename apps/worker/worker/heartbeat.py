"""Worker heartbeat placeholder.

Emits a periodic liveness signal so an operator (or later, System
Administrator's Kesehatan Sistem screen per docs/product/SCREEN_INVENTORY.md)
can tell the worker process is alive. The real analysis_jobs claim loop
(docs/architecture/SEQUENCE_FLOWS.md Diagram 4) is implemented in a later
block once Supabase schema/RLS exists — this block only establishes the
process skeleton.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from datetime import UTC, datetime

logger = logging.getLogger("mboyo.worker.heartbeat")


async def heartbeat(interval_seconds: float) -> AsyncIterator[datetime]:
    """Yields the current UTC time once per ``interval_seconds``.

    A generator rather than an infinite `while True` loop with a bare sleep
    so callers (and tests) can control iteration count explicitly instead of
    needing to interrupt a genuinely infinite loop.
    """
    while True:
        now = datetime.now(UTC)
        logger.info("worker heartbeat", extra={"timestamp": now.isoformat()})
        yield now
        await asyncio.sleep(interval_seconds)
