"""Processes one claimed analysis_job end to end: fetch evidence, validate,
run inference via apps/ml-api, store the prediction/explanation, transition
the report — per docs/product/STATE_MACHINES.md's
analysis_running -> analysis_completed / needs_manual_review transitions.

Idempotency (the "worker restart does not duplicate results" acceptance
criterion): every write here is either itself idempotent
(mark_report_analysis_running is a conditional UPDATE, a no-op if already
past that state) or protected by a database uniqueness constraint
(model_predictions.analysis_job_id is UNIQUE, enforced by
record_analysis_result) — process_job() explicitly catches the unique-
violation case and treats it as "this job's result was already recorded by
a previous attempt," logging and returning success rather than erroring.
This is what makes a worker crash-and-restart between claiming a job and
finishing it safe: the next claim cycle (after reclaim_stale_analysis_jobs
requeues it) re-runs process_job(), which either produces the first real
result or discovers one already exists and stops cleanly.
"""

from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass
from typing import Any

from worker.audit import append_audit_event
from worker.ml_api_client import MlApiClient, MlApiError
from worker.supabase_client import SupabaseClientProtocol, SupabaseRequestError

logger = logging.getLogger("mboyo.worker.processing")

# quality_score below this floor (independent of apps/ml-api's own
# abstained flag) also routes a report to needs_manual_review — per
# docs/product/STATE_MACHINES.md's analysis_completed -> needs_manual_review
# transition ("quality_score below configured threshold").
QUALITY_SCORE_MANUAL_REVIEW_FLOOR = 0.3


@dataclass(frozen=True)
class AnalysisJob:
    id: str
    report_id: str
    attempts: int
    # The apps/web API request that originally enqueued this job, if any
    # (BLOCK 28 — analysis_jobs.request_id). None for jobs created any other
    # way (e.g. future admin/demo tooling) — process_job() mints a fresh
    # request_id in that case, exactly as it always has.
    request_id: str | None = None


@dataclass(frozen=True)
class ProcessJobOutcome:
    job_id: str
    report_id: str
    status: str  # "completed", "needs_manual_review", "already_processed", "failed_transient"


async def _fetch_primary_evidence(
    supabase: SupabaseClientProtocol, report_id: str
) -> dict[str, Any] | None:
    return await supabase.select_one(
        "report_evidence",
        {"report_id": f"eq.{report_id}", "order": "uploaded_at.asc"},
        columns="id,storage_path,mime_type",
    )


async def process_job(
    job: AnalysisJob,
    supabase: SupabaseClientProtocol,
    ml_api: MlApiClient,
    max_attempts: int,
) -> ProcessJobOutcome:
    # Reuses the originating apps/web request-id when the job carries one
    # (BLOCK 28), so a report's full web -> worker -> ml-api trace can be
    # reconstructed by filtering logs on one ID, instead of the worker
    # minting its own disconnected ID every time.
    request_id = job.request_id or str(uuid.uuid4())
    logger.info(
        "processing analysis_job",
        extra={"job_id": job.id, "report_id": job.report_id, "request_id": request_id},
    )

    await supabase.call_rpc("mark_report_analysis_running", {"p_report_id": job.report_id})
    await append_audit_event(
        supabase, "analysis_job", job.id, "analysis_job.claimed", {"report_id": job.report_id}
    )

    evidence = await _fetch_primary_evidence(supabase, job.report_id)
    if evidence is None:
        await _fail_job(
            supabase, job, "No report_evidence row found for this report.", max_attempts
        )
        return ProcessJobOutcome(job.id, job.report_id, "failed_transient")

    try:
        image_bytes = await supabase.download_evidence(evidence["storage_path"])
    except SupabaseRequestError as exc:
        await _fail_job(supabase, job, f"Evidence download failed: {exc}", max_attempts)
        return ProcessJobOutcome(job.id, job.report_id, "failed_transient")

    try:
        prediction = await ml_api.predict(
            job.report_id, image_bytes, evidence["mime_type"], request_id
        )
    except MlApiError as exc:
        await _fail_job(supabase, job, f"apps/ml-api /predict failed: {exc}", max_attempts)
        return ProcessJobOutcome(job.id, job.report_id, "failed_transient")

    explanation_type: str | None = None
    explanation_payload: dict[str, Any] | None = None
    try:
        explanation = await ml_api.explain(
            job.report_id, image_bytes, evidence["mime_type"], prediction.prediction, request_id
        )
        explanation_type = "occlusion_sensitivity"
        explanation_payload = {
            "heatmapPngBase64": explanation.heatmap_png_base64,
            "targetClass": explanation.target_class,
            "disclaimer": explanation.disclaimer,
        }
    except MlApiError as exc:
        # /explain is assistive, not required for a valid prediction —
        # its failure does not fail the whole job, only omits the
        # explanation attachment (logged, not silently swallowed).
        logger.warning(
            "apps/ml-api /explain failed, proceeding without an explanation",
            extra={"job_id": job.id, "error": str(exc)},
        )

    needs_manual_review = (
        prediction.abstained
        or prediction.is_advisory_only
        or prediction.is_demo_fallback
        or prediction.quality_score < QUALITY_SCORE_MANUAL_REVIEW_FLOOR
    )

    try:
        await supabase.call_rpc(
            "record_analysis_result",
            {
                "p_analysis_job_id": job.id,
                "p_report_id": job.report_id,
                "p_model_registry_entry_id": None,
                "p_severity_probabilities": prediction.calibrated_probabilities,
                "p_quality_score": prediction.quality_score,
                "p_is_advisory_only": prediction.is_advisory_only or prediction.is_demo_fallback,
                "p_needs_manual_review": needs_manual_review,
                "p_duplicate_candidate_report_id": None,
                "p_explanation_type": explanation_type,
                "p_explanation_payload": explanation_payload,
                "p_model_latency_ms": prediction.latency_ms,
            },
        )
    except SupabaseRequestError as exc:
        if _is_unique_violation(exc):
            logger.info(
                "analysis_job result already recorded by a prior attempt — treating as success",
                extra={"job_id": job.id},
            )
            return ProcessJobOutcome(job.id, job.report_id, "already_processed")
        await _fail_job(supabase, job, f"record_analysis_result failed: {exc}", max_attempts)
        return ProcessJobOutcome(job.id, job.report_id, "failed_transient")

    await append_audit_event(
        supabase,
        "analysis_job",
        job.id,
        "analysis_job.completed",
        {
            "model_version": prediction.model_version,
            "is_advisory_only": prediction.is_advisory_only,
            "is_demo_fallback": prediction.is_demo_fallback,
        },
    )

    if needs_manual_review:
        await append_audit_event(
            supabase,
            "report",
            job.report_id,
            "report.flagged_for_manual_review",
            {
                "reason": "abstained"
                if prediction.abstained
                else ("advisory_only" if prediction.is_advisory_only else "low_quality"),
            },
        )
        return ProcessJobOutcome(job.id, job.report_id, "needs_manual_review")

    return ProcessJobOutcome(job.id, job.report_id, "completed")


async def _fail_job(
    supabase: SupabaseClientProtocol, job: AnalysisJob, error_message: str, max_attempts: int
) -> None:
    logger.warning("analysis_job failed", extra={"job_id": job.id, "error": error_message})
    await supabase.call_rpc(
        "fail_analysis_job",
        {
            "p_analysis_job_id": job.id,
            "p_report_id": job.report_id,
            "p_error": error_message,
            "p_max_attempts": max_attempts,
        },
    )


UNIQUE_VIOLATION_SQLSTATE = "23505"


def _is_unique_violation(exc: SupabaseRequestError) -> bool:
    """PostgREST surfaces a Postgres unique_violation as a 409 Conflict
    with a JSON body `{"code": "23505", "message": ..., ...}` — the SQLSTATE
    model_predictions.analysis_job_id's UNIQUE constraint raises. Parses
    the body as JSON to check the `code` field precisely (mirroring
    apps/web/src/lib/reports/service/location.ts's
    `PostgrestLikeError.code`-based translation pattern) rather than
    substring-matching the raw response text, which could false-positive on
    an unrelated error message that happens to mention "23505"."""
    if exc.status_code != 409:
        return False
    try:
        parsed = json.loads(exc.body)
    except (json.JSONDecodeError, TypeError):
        return False
    return isinstance(parsed, dict) and parsed.get("code") == UNIQUE_VIOLATION_SQLSTATE
