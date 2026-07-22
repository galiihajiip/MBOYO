"""A minimal Supabase client for apps/worker — PostgREST (RPC calls, table
reads) and Storage (private evidence download), both via `httpx` (already a
listed dependency) rather than adding the official `supabase-py` SDK as a
new dependency, since apps/worker only needs a handful of specific
operations (call an RPC function, download a storage object, read/update a
couple of tables) — a thin wrapper keeps the dependency footprint aligned
with this app's existing minimal-dependency style (pydantic-settings +
httpx only, per pyproject.toml).

Every request authenticates with `SUPABASE_SERVICE_ROLE_KEY` as both the
`apikey` and `Authorization: Bearer` header — this is the standard
Supabase REST/Storage service-role auth pattern, which bypasses RLS
entirely (the same mechanism apps/web's `getServiceRoleClient()` uses,
per AGENTS.md/DEPLOYMENT_TOPOLOGY.md: "Worker -- service-role, private
egress --> Storage").
"""

from __future__ import annotations

from typing import Any, Protocol

import httpx


class SupabaseRequestError(RuntimeError):
    """Raised when a Supabase REST/Storage/RPC call returns a non-2xx response."""

    def __init__(self, message: str, status_code: int, body: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.body = body


class SupabaseClientProtocol(Protocol):
    """The subset of SupabaseClient's interface worker/processing.py and
    worker/claim_loop.py actually depend on — used as their type hint
    instead of the concrete SupabaseClient class, so tests can substitute a
    lightweight fake (see tests/test_processing.py's FakeSupabaseClient)
    without needing an httpx.MockTransport for every test (that transport
    layer is already covered directly by tests/test_supabase_client.py).
    """

    async def call_rpc(self, function_name: str, params: dict[str, Any]) -> Any: ...

    async def select_one(
        self, table: str, filters: dict[str, str], columns: str = "*"
    ) -> dict[str, Any] | None: ...

    async def download_evidence(self, storage_path: str) -> bytes: ...


class SupabaseClient:
    def __init__(
        self,
        supabase_url: str,
        service_role_key: str,
        reports_bucket: str,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._base_url = supabase_url.rstrip("/")
        self._service_role_key = service_role_key
        self._reports_bucket = reports_bucket
        self._client = client or httpx.AsyncClient(timeout=30.0)

    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self._service_role_key,
            "Authorization": f"Bearer {self._service_role_key}",
            "Content-Type": "application/json",
        }

    async def call_rpc(self, function_name: str, params: dict[str, Any]) -> Any:
        response = await self._client.post(
            f"{self._base_url}/rest/v1/rpc/{function_name}",
            headers=self._headers(),
            json=params,
        )
        if response.status_code >= 400:
            raise SupabaseRequestError(
                f"RPC {function_name} failed with status {response.status_code}",
                response.status_code,
                response.text,
            )
        result: Any = response.json()
        return result

    async def select_one(
        self, table: str, filters: dict[str, str], columns: str = "*"
    ) -> dict[str, Any] | None:
        params = {"select": columns, **filters, "limit": "1"}
        response = await self._client.get(
            f"{self._base_url}/rest/v1/{table}", headers=self._headers(), params=params
        )
        if response.status_code >= 400:
            raise SupabaseRequestError(
                f"select from {table} failed with status {response.status_code}",
                response.status_code,
                response.text,
            )
        rows: list[dict[str, Any]] = response.json()
        return rows[0] if rows else None

    async def download_evidence(self, storage_path: str) -> bytes:
        """Downloads a private object from the evidence bucket via
        service-role auth — bypasses storage.objects RLS entirely, the
        documented, narrow exception for this internal server-to-server
        path (never a browser-facing signed URL, since this is not a
        browser call)."""
        response = await self._client.get(
            f"{self._base_url}/storage/v1/object/{self._reports_bucket}/{storage_path}",
            headers=self._headers(),
        )
        if response.status_code >= 400:
            raise SupabaseRequestError(
                f"evidence download for {storage_path} failed with status {response.status_code}",
                response.status_code,
                response.text,
            )
        return response.content

    async def aclose(self) -> None:
        await self._client.aclose()
