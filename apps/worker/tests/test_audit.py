from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import pytest

from worker.audit import append_audit_event


@dataclass
class FakeSupabaseClient:
    """Minimal stand-in for SupabaseClientProtocol — records every rpc call,
    matching the pattern used in tests/test_processing.py and
    tests/test_claim_loop.py."""

    rpc_calls: list[tuple[str, dict[str, Any]]] = field(default_factory=list)

    async def call_rpc(self, function_name: str, params: dict[str, Any]) -> Any:
        self.rpc_calls.append((function_name, params))
        return None

    async def select_one(
        self, table: str, filters: dict[str, str], columns: str = "*"
    ) -> dict[str, Any] | None:
        raise NotImplementedError

    async def download_evidence(self, storage_path: str) -> bytes:
        raise NotImplementedError


@pytest.mark.asyncio
async def test_append_audit_event_calls_the_append_audit_event_rpc() -> None:
    supabase = FakeSupabaseClient()

    await append_audit_event(
        supabase,
        "analysis_job",
        "job-1",
        "analysis_job.claimed",
        {"worker_id": "worker-1"},
    )

    assert len(supabase.rpc_calls) == 1
    function_name, params = supabase.rpc_calls[0]
    assert function_name == "append_audit_event"
    assert params == {
        "p_entity_type": "analysis_job",
        "p_entity_id": "job-1",
        "p_action": "analysis_job.claimed",
        "p_detail": {"worker_id": "worker-1"},
    }


@pytest.mark.asyncio
async def test_append_audit_event_forwards_arbitrary_detail_payloads() -> None:
    supabase = FakeSupabaseClient()
    detail = {"attempts": 2, "nested": {"reason": "timeout"}, "values": [1, 2, 3]}

    await append_audit_event(supabase, "analysis_job", "job-2", "analysis_job.completed", detail)

    _function_name, params = supabase.rpc_calls[0]
    assert params["p_detail"] == detail


@pytest.mark.asyncio
async def test_append_audit_event_propagates_rpc_errors() -> None:
    class RaisingSupabaseClient(FakeSupabaseClient):
        async def call_rpc(self, function_name: str, params: dict[str, Any]) -> Any:
            raise RuntimeError("rpc failed")

    with pytest.raises(RuntimeError, match="rpc failed"):
        await append_audit_event(
            RaisingSupabaseClient(), "analysis_job", "job-3", "analysis_job.failed", {}
        )
