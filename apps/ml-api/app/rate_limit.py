"""A minimal in-process rate limiter for apps/ml-api.

This service has no public ingress (docs/architecture/DEPLOYMENT_TOPOLOGY.md
— reachable only from apps/web and apps/worker on a private network path),
so this limiter is defense-in-depth against a misbehaving internal caller
(e.g. a worker retry loop gone wrong) rather than the primary anti-abuse
control (that's THREAT_MODEL.md's per-account/per-IP limiting at the
apps/web BFF layer, upstream of here). A simple fixed-window counter keyed
by client IP is sufficient for that purpose — no external store (Redis
etc.) is justified for a single-process internal service.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque


class RateLimiter:
    def __init__(self, requests_per_minute: int) -> None:
        self._requests_per_minute = requests_per_minute
        self._window_seconds = 60.0
        self._history: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        history = self._history[key]

        while history and history[0] <= now - self._window_seconds:
            history.popleft()

        if len(history) >= self._requests_per_minute:
            return False

        history.append(now)
        return True
