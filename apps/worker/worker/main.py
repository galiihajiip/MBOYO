"""apps/worker process entry point.

Run with: python -m worker.main (from within apps/worker, with its
virtualenv/deps installed) — see root package.json's `dev:worker` script.

Runs three concurrent loops for the lifetime of the process:
  1. The heartbeat (liveness signal for operator/health tooling).
  2. The analysis_jobs claim loop (claims queued jobs via the atomic
     claim_analysis_jobs RPC, processes each via worker/processing.py).
  3. The reclaim sweep (requeues/dead-letters jobs stuck in 'processing'
     past their lease — recovers from a crashed prior worker instance).
"""

from __future__ import annotations

import asyncio
import logging

from worker.claim_loop import run_claim_loop, run_reclaim_sweep_loop
from worker.config import get_settings
from worker.heartbeat import heartbeat
from worker.logging_setup import configure_json_logging
from worker.ml_api_client import MlApiClient
from worker.observability import init_sentry
from worker.supabase_client import SupabaseClient

configure_json_logging(level=logging.INFO)
logger = logging.getLogger("mboyo.worker")


async def _run_heartbeat_forever(interval_seconds: float) -> None:
    async for _ in heartbeat(interval_seconds):
        pass


async def _run_claim_loop_forever(
    supabase: SupabaseClient,
    ml_api: MlApiClient,
    worker_id: str,
    batch_size: int,
    poll_interval_seconds: float,
) -> None:
    async for _ in run_claim_loop(supabase, ml_api, worker_id, batch_size, poll_interval_seconds):
        pass


async def _run_reclaim_sweep_forever(
    supabase: SupabaseClient, lease_seconds: int, max_attempts: int, sweep_interval_seconds: float
) -> None:
    async for _ in run_reclaim_sweep_loop(
        supabase, lease_seconds, max_attempts, sweep_interval_seconds
    ):
        pass


async def run() -> None:
    settings = get_settings()
    init_sentry(settings)
    logger.info(
        "worker starting",
        extra={"ml_api_url": settings.ml_api_url, "worker_id": settings.worker_id},
    )

    supabase = SupabaseClient(
        settings.supabase_url, settings.supabase_service_role_key, settings.supabase_reports_bucket
    )
    ml_api = MlApiClient(settings.ml_api_url, settings.ml_internal_token)

    try:
        await asyncio.gather(
            _run_heartbeat_forever(settings.heartbeat_interval_seconds),
            _run_claim_loop_forever(
                supabase,
                ml_api,
                settings.worker_id,
                settings.claim_batch_size,
                settings.claim_poll_interval_seconds,
            ),
            _run_reclaim_sweep_forever(
                supabase,
                settings.processing_lease_seconds,
                settings.max_attempts,
                settings.reclaim_sweep_interval_seconds,
            ),
        )
    finally:
        await supabase.aclose()
        await ml_api.aclose()


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
