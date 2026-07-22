from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from unittest.mock import AsyncMock

import pytest

from worker.claim_loop import claim_and_process_once
from worker.ml_api_client import PredictResult


@dataclass
class FakeSupabaseClient:
    claim_responses: list[list[dict[str, Any]]] = field(default_factory=list)
    rpc_calls: list[tuple[str, dict[str, Any]]] = field(default_factory=list)
    process_job_should_raise: bool = False

    async def call_rpc(self, function_name: str, params: dict[str, Any]) -> Any:
        self.rpc_calls.append((function_name, params))
        if function_name == "claim_analysis_jobs":
            return self.claim_responses.pop(0) if self.claim_responses else []
        if function_name == "mark_report_analysis_running":
            return {}
        if function_name == "record_analysis_result":
            if self.process_job_should_raise:
                raise RuntimeError("simulated unexpected failure")
            return {}
        return {}

    async def select_one(
        self, table: str, filters: dict[str, str], columns: str = "*"
    ) -> dict[str, Any] | None:
        return {"id": "ev-1", "storage_path": "report-1/hash", "mime_type": "image/jpeg"}

    async def download_evidence(self, storage_path: str) -> bytes:
        return b"fake-bytes"


def _predict_result_mock() -> PredictResult:
    return PredictResult(
        prediction="minor_damage",
        calibrated_probabilities={
            "unknown": 0.1,
            "no_damage": 0.1,
            "minor_damage": 0.5,
            "major_damage": 0.2,
            "destroyed": 0.1,
        },
        confidence=0.5,
        entropy=1.0,
        abstained=False,
        abstention_reasons=(),
        quality_score=0.9,
        quality_passed=True,
        model_version="v1",
        model_checksum="abc",
        is_advisory_only=False,
        is_demo_fallback=False,
        disclaimer="disclaimer",
        latency_ms=5.0,
    )


@pytest.mark.asyncio
async def test_claim_and_process_once_returns_zero_when_queue_is_empty() -> None:
    supabase = FakeSupabaseClient(claim_responses=[[]])
    ml_api = AsyncMock()

    claimed_count = await claim_and_process_once(
        supabase, ml_api, "worker-1", batch_size=1, max_attempts=3
    )

    assert claimed_count == 0


@pytest.mark.asyncio
async def test_claim_and_process_once_processes_every_claimed_job() -> None:
    from worker.ml_api_client import ExplainResult

    supabase = FakeSupabaseClient(
        claim_responses=[
            [
                {"id": "job-1", "report_id": "report-1", "attempts": 1},
                {"id": "job-2", "report_id": "report-2", "attempts": 1},
            ]
        ]
    )
    ml_api = AsyncMock()
    ml_api.predict.return_value = _predict_result_mock()
    ml_api.explain.return_value = ExplainResult("base64png", "minor_damage", "disclaimer")

    claimed_count = await claim_and_process_once(
        supabase, ml_api, "worker-1", batch_size=2, max_attempts=3
    )

    assert claimed_count == 2
    assert ml_api.predict.call_count == 2


@pytest.mark.asyncio
async def test_claim_and_process_once_does_not_crash_on_unexpected_job_error() -> None:
    """A single job raising an unhandled exception must not prevent the
    claim loop itself from returning normally — the reclaim sweep (a
    separate mechanism) is what recovers such a job later."""
    supabase = FakeSupabaseClient(
        claim_responses=[[{"id": "job-1", "report_id": "report-1", "attempts": 1}]],
        process_job_should_raise=True,
    )
    ml_api = AsyncMock()
    ml_api.predict.return_value = _predict_result_mock()
    ml_api.explain.return_value = None

    claimed_count = await claim_and_process_once(
        supabase, ml_api, "worker-1", batch_size=1, max_attempts=3
    )

    # The claim itself succeeded (1 job was claimed), even though processing
    # that job hit an unexpected error internally.
    assert claimed_count == 1
