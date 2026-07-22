"""Conditional Sentry init for apps/worker (BLOCK 28).

No-op when settings.sentry_dsn is unset — mirrors apps/ml-api/app/observability.py
exactly.
"""

from __future__ import annotations

import sentry_sdk

from worker.config import Settings


def init_sentry(settings: Settings) -> None:
    if not settings.sentry_dsn:
        return
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        traces_sample_rate=0.1,
        send_default_pii=False,
    )
