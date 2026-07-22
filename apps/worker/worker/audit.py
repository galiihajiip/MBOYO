"""Audit-event writes for apps/worker, via the existing
public.append_audit_event RPC (supabase/migrations/20260716153713_rpc_functions.sql).

That function attributes the event to `current_profile_id()`, which
resolves `auth.uid()` under the calling connection's JWT claims — a
service-role connection carries no user JWT, so `auth.uid()` is NULL and
`current_profile_id()` correctly resolves to NULL too, i.e. "no human
actor," which is exactly the "system" attribution apps/worker's own
actions (analysis_job.claimed, analysis_job.completed, etc.) require. No
new RPC or worker-specific write path was needed for this — the existing
function already does the right thing for a service-role caller.
"""

from __future__ import annotations

from typing import Any

from worker.supabase_client import SupabaseClientProtocol


async def append_audit_event(
    client: SupabaseClientProtocol,
    entity_type: str,
    entity_id: str,
    action: str,
    detail: dict[str, Any],
) -> None:
    await client.call_rpc(
        "append_audit_event",
        {
            "p_entity_type": entity_type,
            "p_entity_id": entity_id,
            "p_action": action,
            "p_detail": detail,
        },
    )
