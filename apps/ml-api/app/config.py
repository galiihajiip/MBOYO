"""Environment configuration for apps/ml-api.

Mirrors the shared server-side environment contract described in
packages/domain/src/env.ts — only the subset apps/ml-api actually needs.
Never import Gemini/session/VAPID/Supabase-service-role secrets here; this
stateless service has no reason to hold them (docs/architecture/SYSTEM_ARCHITECTURE.md).
"""

from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Validated environment for the ML inference service.

    ``ml_internal_token`` has no default: a missing value fails loudly at
    Settings() construction rather than silently running with an empty
    credential (app/auth.py's require_internal_token also fails closed if
    this is empty, as defense in depth — but the goal here is to fail at
    startup, before the first request, not on the first request).

    ``model_artifact_dir`` points at a directory containing an exported
    model (BLOCK 20's ml/src/training/export.py output: `<version>.onnx` +
    `<version>_metadata.json`) plus a `active_version.txt` file naming which
    version is currently active — this indirection lets a new model be
    promoted by writing one small text file rather than redeploying the
    service. If the directory or the named files don't exist, this service
    has no model to serve — see app/model_registry.py for how that
    "no active model" state is handled (readiness fails, or, if
    ``demo_mode`` is true, a clearly-labeled deterministic fallback serves
    instead, per docs/architecture/SYSTEM_ARCHITECTURE.md's demo-mode
    scope).

    ``demo_mode`` broadens the DEMO_MODE flag's existing scope
    (previously the Reporter's offline/reconnect UI toggle only) to also
    permit this deterministic fallback — a user-approved decision in this
    block's own working-contract entry, since AGENTS.md's general "any
    demo fallback must be labeled" rule implies ml-api needs *some* labeled
    fallback path, and DEMO_MODE is the established flag name/mechanism to
    reuse rather than inventing a second one.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ml_internal_token: str = Field(min_length=1)
    app_env: str = "development"
    demo_mode: bool = False
    model_artifact_dir: Path = Path("models")
    allowed_origins: tuple[str, ...] = ()
    rate_limit_requests_per_minute: int = 120
    # Optional (BLOCK 28) — Sentry init is a no-op when this is unset, per
    # this codebase's "the app works with zero optional-feature
    # configuration" posture (see app/observability.py).
    sentry_dsn: str | None = None


def get_settings() -> Settings:
    """Constructs Settings from the environment.

    Not memoized at import time so importing this module (e.g. during
    static analysis or tests) never requires real secrets to be present —
    only calling get_settings() does.
    """
    return Settings()  # type: ignore[call-arg]  # pydantic-settings supplies required fields from env at runtime
