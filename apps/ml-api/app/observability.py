"""Conditional Sentry init for apps/ml-api (BLOCK 28).

No-op when settings.sentry_dsn is unset — matches the same posture as
apps/web's lib/observability/sentry.server.ts and apps/worker's
worker/observability.py.
"""

from __future__ import annotations

import sentry_sdk

from app.config import Settings


def init_sentry(settings: Settings) -> None:
    if not settings.sentry_dsn:
        return
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        traces_sample_rate=0.1,
        # send_default_pii defaults to False in sentry-sdk — left at that
        # default explicitly (not overridden to True) since this service
        # handles report evidence images/predictions, and an unhandled
        # exception's captured request context should never include a
        # raw image payload.
        send_default_pii=False,
    )
