"""The analysis_jobs claim loop — safely claims queued jobs via the
atomic public.claim_analysis_jobs RPC (FOR UPDATE SKIP LOCKED, per
docs/adr/0003-database-job-queue.md), so concurrent worker instances never
double-claim the same job, and processes each claimed job in turn.

Also periodically sweeps for stale 'processing' jobs (a worker that
crashed mid-job, per this block's "worker restart does not duplicate
results" acceptance criterion) via public.reclaim_stale_analysis_jobs,
requeuing them for another attempt or dead-lettering them past
max_attempts.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from typing import Any

from worker.ml_api_client import MlApiClient
from worker.processing import AnalysisJob, process_job
from worker.supabase_client import SupabaseClientProtocol

logger = logging.getLogger("mboyo.worker.claim_loop")


async def claim_and_process_once(
    supabase: SupabaseClientProtocol,
    ml_api: MlApiClient,
    worker_id: str,
    batch_size: int,
    max_attempts: int,
) -> int:
    """Claims up to `batch_size` queued jobs and processes each in turn,
    returning the number of jobs claimed (0 means the queue was empty this
    cycle — the caller should back off before polling again)."""
    claimed: list[dict[str, Any]] = await supabase.call_rpc(
        "claim_analysis_jobs", {"worker_id": worker_id, "batch_size": batch_size}
    )

    for row in claimed:
        job = AnalysisJob(
            id=row["id"],
            report_id=row["report_id"],
            attempts=row["attempts"],
            request_id=row.get("request_id"),
        )
        try:
            outcome = await process_job(job, supabase, ml_api, max_attempts=max_attempts)
            logger.info(
                "job processed",
                extra={"job_id": job.id, "report_id": job.report_id, "outcome": outcome.status},
            )
        except Exception:
            # A truly unexpected exception (not one of process_job's own
            # handled failure paths) — log it and let the reclaim sweep's
            # lease-expiry mechanism recover the job later, rather than
            # crashing the whole claim loop over one bad job.
            logger.exception("unhandled error processing job", extra={"job_id": job.id})

    return len(claimed)


async def run_claim_loop(
    supabase: SupabaseClientProtocol,
    ml_api: MlApiClient,
    worker_id: str,
    batch_size: int,
    poll_interval_seconds: float,
    max_attempts: int = 3,
) -> AsyncIterator[int]:
    """Yields the number of jobs claimed each cycle — a generator (like
    worker/heartbeat.py's heartbeat()) so callers/tests can control
    iteration count rather than needing to interrupt a genuinely infinite
    loop."""
    while True:
        claimed_count = await claim_and_process_once(
            supabase, ml_api, worker_id, batch_size, max_attempts
        )
        yield claimed_count
        if claimed_count == 0:
            await asyncio.sleep(poll_interval_seconds)


async def run_reclaim_sweep_loop(
    supabase: SupabaseClientProtocol,
    lease_seconds: int,
    max_attempts: int,
    sweep_interval_seconds: float,
) -> AsyncIterator[list[dict[str, Any]]]:
    while True:
        reclaimed: list[dict[str, Any]] = await supabase.call_rpc(
            "reclaim_stale_analysis_jobs",
            {"lease_seconds": lease_seconds, "max_attempts": max_attempts},
        )
        if reclaimed:
            logger.info("reclaimed stale analysis_jobs", extra={"count": len(reclaimed)})
        yield reclaimed
        await asyncio.sleep(sweep_interval_seconds)
