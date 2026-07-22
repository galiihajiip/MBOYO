"""Environment configuration for apps/worker.

apps/worker holds SUPABASE_SERVICE_ROLE_KEY and ML_INTERNAL_TOKEN (per
AGENTS.md and docs/architecture/DEPLOYMENT_TOPOLOGY.md) — never a public
ingress, never a browser-facing credential. Required fields have no default:
a missing value fails loudly at Settings() construction (pydantic raises
ValidationError) rather than silently running with an empty credential.
"""

from __future__ import annotations

from uuid import uuid4

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = Field(min_length=1)
    # Reuses NEXT_PUBLIC_SUPABASE_URL (packages/domain/src/env.ts) rather
    # than a separate worker-only var — the Supabase project URL is not a
    # secret (it's already public in the browser bundle), so there's no
    # reason for apps/worker to need its own differently-named copy of the
    # same value.
    supabase_url: str = Field(min_length=1, alias="NEXT_PUBLIC_SUPABASE_URL")
    supabase_service_role_key: str = Field(min_length=1)
    supabase_reports_bucket: str = "report-evidence"
    ml_api_url: str = "http://localhost:8000"
    ml_internal_token: str = Field(min_length=1)
    heartbeat_interval_seconds: float = 30.0
    worker_id: str = Field(default_factory=lambda: f"worker-{uuid4().hex[:12]}")
    claim_batch_size: int = 1
    claim_poll_interval_seconds: float = 5.0
    reclaim_sweep_interval_seconds: float = 60.0
    processing_lease_seconds: int = 300
    max_attempts: int = 3
    # Optional (BLOCK 28) — Sentry init is a no-op when unset. Reuses
    # apps/ml-api's env var name (not a worker-only-prefixed one) since both
    # services report to the same Sentry project in this codebase's scope.
    sentry_dsn: str | None = None


def get_settings() -> Settings:
    """Constructs Settings from the environment.

    Not memoized — see apps/ml-api/app/config.py for the same rationale
    (importing this module must never require real secrets to be present;
    only calling get_settings() does). Raises pydantic.ValidationError with
    a field-by-field message if any required variable is missing or empty,
    matching the fail-loudly behavior of packages/domain/src/env.ts's
    loadServerEnv on the TypeScript side.
    """
    return Settings()  # type: ignore[call-arg]  # pydantic-settings supplies required fields from env at runtime
