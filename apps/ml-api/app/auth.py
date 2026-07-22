"""Internal-token authentication for apps/ml-api.

Per docs/architecture/DEPLOYMENT_TOPOLOGY.md, apps/ml-api has no public
ingress, but every request is still required to carry ML_INTERNAL_TOKEN —
defense in depth per docs/security/THREAT_MODEL.md.
"""

from fastapi import Depends, Header, HTTPException, status

from app.config import Settings, get_settings


def require_internal_token(
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> None:
    if not settings.ml_internal_token:
        # No token configured (e.g. local dev without a .env) — fail closed
        # rather than silently accepting every request.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ML_INTERNAL_TOKEN is not configured on this server.",
        )

    expected = f"Bearer {settings.ml_internal_token}"
    if authorization != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing internal token.",
        )
