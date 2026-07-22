from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from unittest.mock import AsyncMock

import pytest

from worker.ml_api_client import ExplainResult, MlApiError, PredictResult
from worker.processing import AnalysisJob, process_job
from worker.supabase_client import SupabaseRequestError


def _predict_result(
    prediction: str = "minor_damage",
    abstained: bool = False,
    is_advisory_only: bool = False,
    is_demo_fallback: bool = False,
    quality_score: float = 0.9,
) -> PredictResult:
    return PredictResult(
        prediction=prediction,
        calibrated_probabilities={
            "unknown": 0.1,
            "no_damage": 0.1,
            "minor_damage": 0.5,
            "major_damage": 0.2,
            "destroyed": 0.1,
        },
        confidence=0.5,
        entropy=1.0,
        abstained=abstained,
        abstention_reasons=("low_confidence",) if abstained else (),
        quality_score=quality_score,
        quality_passed=quality_score >= 0.3,
        model_version="v1",
        model_checksum="abc123",
        is_advisory_only=is_advisory_only,
        is_demo_fallback=is_demo_fallback,
        disclaimer="disclaimer",
        latency_ms=10.0,
    )


@dataclass
class FakeSupabaseClient:
    """A minimal stand-in for SupabaseClient — records every rpc call and
    lets a test script canned responses/exceptions per rpc function name,
    without needing an httpx.MockTransport for this module's own tests
    (worker/tests/test_supabase_client.py already covers that transport
    layer directly)."""

    evidence_row: dict[str, Any] | None = field(
        default_factory=lambda: {
            "id": "ev-1",
            "storage_path": "report-1/hash",
            "mime_type": "image/jpeg",
        }
    )
    evidence_bytes: bytes = b"fake-evidence-bytes"
    record_analysis_result_error: SupabaseRequestError | None = None
    rpc_calls: list[tuple[str, dict[str, Any]]] = field(default_factory=list)

    async def call_rpc(self, function_name: str, params: dict[str, Any]) -> Any:
        self.rpc_calls.append((function_name, params))
        if function_name == "record_analysis_result" and self.record_analysis_result_error:
            raise self.record_analysis_result_error
        return {}

    async def select_one(
        self, table: str, filters: dict[str, str], columns: str = "*"
    ) -> dict[str, Any] | None:
        return self.evidence_row

    async def download_evidence(self, storage_path: str) -> bytes:
        return self.evidence_bytes


def _job() -> AnalysisJob:
    return AnalysisJob(id="job-1", report_id="report-1", attempts=1)


@pytest.mark.asyncio
async def test_process_job_completes_successfully_for_a_confident_prediction() -> None:
    supabase = FakeSupabaseClient()
    ml_api = AsyncMock()
    ml_api.predict.return_value = _predict_result()
    ml_api.explain.return_value = ExplainResult("base64png", "minor_damage", "occlusion disclaimer")

    outcome = await process_job(_job(), supabase, ml_api, max_attempts=3)

    assert outcome.status == "completed"
    rpc_names = [name for name, _params in supabase.rpc_calls]
    assert "mark_report_analysis_running" in rpc_names
    assert "record_analysis_result" in rpc_names
    record_call = next(
        params for name, params in supabase.rpc_calls if name == "record_analysis_result"
    )
    assert record_call["p_needs_manual_review"] is False
    assert record_call["p_explanation_type"] == "occlusion_sensitivity"


@pytest.mark.asyncio
async def test_process_job_routes_to_manual_review_when_abstained() -> None:
    supabase = FakeSupabaseClient()
    ml_api = AsyncMock()
    ml_api.predict.return_value = _predict_result(abstained=True)
    ml_api.explain.return_value = ExplainResult("base64png", "minor_damage", "disclaimer")

    outcome = await process_job(_job(), supabase, ml_api, max_attempts=3)

    assert outcome.status == "needs_manual_review"
    record_call = next(
        params for name, params in supabase.rpc_calls if name == "record_analysis_result"
    )
    assert record_call["p_needs_manual_review"] is True


@pytest.mark.asyncio
async def test_process_job_routes_to_manual_review_when_advisory_only() -> None:
    supabase = FakeSupabaseClient()
    ml_api = AsyncMock()
    ml_api.predict.return_value = _predict_result(is_advisory_only=True)
    ml_api.explain.return_value = ExplainResult("base64png", "minor_damage", "disclaimer")

    outcome = await process_job(_job(), supabase, ml_api, max_attempts=3)

    assert outcome.status == "needs_manual_review"


@pytest.mark.asyncio
async def test_process_job_routes_to_manual_review_when_demo_fallback() -> None:
    supabase = FakeSupabaseClient()
    ml_api = AsyncMock()
    ml_api.predict.return_value = _predict_result(is_demo_fallback=True)
    ml_api.explain.return_value = ExplainResult("base64png", "minor_damage", "disclaimer")

    outcome = await process_job(_job(), supabase, ml_api, max_attempts=3)

    assert outcome.status == "needs_manual_review"


@pytest.mark.asyncio
async def test_process_job_routes_to_manual_review_for_low_quality() -> None:
    supabase = FakeSupabaseClient()
    ml_api = AsyncMock()
    ml_api.predict.return_value = _predict_result(quality_score=0.1)
    ml_api.explain.return_value = ExplainResult("base64png", "minor_damage", "disclaimer")

    outcome = await process_job(_job(), supabase, ml_api, max_attempts=3)

    assert outcome.status == "needs_manual_review"


@pytest.mark.asyncio
async def test_process_job_fails_transiently_when_no_evidence_exists() -> None:
    supabase = FakeSupabaseClient(evidence_row=None)
    ml_api = AsyncMock()

    outcome = await process_job(_job(), supabase, ml_api, max_attempts=3)

    assert outcome.status == "failed_transient"
    rpc_names = [name for name, _params in supabase.rpc_calls]
    assert "fail_analysis_job" in rpc_names
    ml_api.predict.assert_not_called()


@pytest.mark.asyncio
async def test_process_job_fails_transiently_when_ml_api_predict_errors() -> None:
    supabase = FakeSupabaseClient()
    ml_api = AsyncMock()
    ml_api.predict.side_effect = MlApiError("boom", 503, {"error": {"code": "model_not_loaded"}})

    outcome = await process_job(_job(), supabase, ml_api, max_attempts=3)

    assert outcome.status == "failed_transient"
    rpc_names = [name for name, _params in supabase.rpc_calls]
    assert "fail_analysis_job" in rpc_names
    assert "record_analysis_result" not in rpc_names


@pytest.mark.asyncio
async def test_process_job_continues_without_explanation_when_explain_fails() -> None:
    supabase = FakeSupabaseClient()
    ml_api = AsyncMock()
    ml_api.predict.return_value = _predict_result()
    ml_api.explain.side_effect = MlApiError("explain failed", 500, None)

    outcome = await process_job(_job(), supabase, ml_api, max_attempts=3)

    assert outcome.status == "completed"
    record_call = next(
        params for name, params in supabase.rpc_calls if name == "record_analysis_result"
    )
    assert record_call["p_explanation_type"] is None


@pytest.mark.asyncio
async def test_process_job_treats_a_duplicate_result_as_already_processed() -> None:
    """The core idempotency guarantee: if record_analysis_result raises a
    unique-constraint violation (409 with SQLSTATE 23505 — i.e. a prior
    worker attempt already recorded this job's prediction), process_job
    must NOT treat this as a failure that triggers another retry/dead-letter
    — it should recognize the job is already done."""
    supabase = FakeSupabaseClient(
        record_analysis_result_error=SupabaseRequestError(
            "conflict", 409, '{"code": "23505", "message": "duplicate key value"}'
        )
    )
    ml_api = AsyncMock()
    ml_api.predict.return_value = _predict_result()
    ml_api.explain.return_value = ExplainResult("base64png", "minor_damage", "disclaimer")

    outcome = await process_job(_job(), supabase, ml_api, max_attempts=3)

    assert outcome.status == "already_processed"
    rpc_names = [name for name, _params in supabase.rpc_calls]
    assert "fail_analysis_job" not in rpc_names


@pytest.mark.asyncio
async def test_process_job_fails_transiently_on_a_non_duplicate_record_error() -> None:
    supabase = FakeSupabaseClient(
        record_analysis_result_error=SupabaseRequestError("server error", 500, "internal error")
    )
    ml_api = AsyncMock()
    ml_api.predict.return_value = _predict_result()
    ml_api.explain.return_value = ExplainResult("base64png", "minor_damage", "disclaimer")

    outcome = await process_job(_job(), supabase, ml_api, max_attempts=3)

    assert outcome.status == "failed_transient"
    rpc_names = [name for name, _params in supabase.rpc_calls]
    assert "fail_analysis_job" in rpc_names


@pytest.mark.asyncio
async def test_process_job_fails_transiently_on_a_409_with_malformed_json_body() -> None:
    """A 409 whose body isn't parseable JSON (e.g. an HTML error page from
    an intermediary proxy) must not be mistaken for the specific
    23505-unique-violation case — _is_unique_violation must fail safe
    (treat it as a different, non-duplicate failure) rather than raising."""
    supabase = FakeSupabaseClient(
        record_analysis_result_error=SupabaseRequestError("conflict", 409, "not valid json at all")
    )
    ml_api = AsyncMock()
    ml_api.predict.return_value = _predict_result()
    ml_api.explain.return_value = ExplainResult("base64png", "minor_damage", "disclaimer")

    outcome = await process_job(_job(), supabase, ml_api, max_attempts=3)

    assert outcome.status == "failed_transient"
    rpc_names = [name for name, _params in supabase.rpc_calls]
    assert "fail_analysis_job" in rpc_names
