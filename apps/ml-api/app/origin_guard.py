"""Strict-origin enforcement middleware.

apps/ml-api has no public ingress and is never called from a browser
(docs/architecture/DEPLOYMENT_TOPOLOGY.md — reachable only from apps/web's
server runtime and apps/worker, both server-to-server callers). A
browser-style `Origin` header should therefore never appear on a
legitimate request at all; if one does, it's a sign of a misconfigured
caller or a request that leaked to an unexpected surface. Rather than
running permissive CORS middleware (which exists to ALLOW cross-origin
browser calls), this middleware does the opposite: it rejects any request
carrying an `Origin` header that isn't explicitly allowlisted via
`settings.allowed_origins` (empty by default, meaning "reject every
browser-origin request").
"""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.config import get_settings


class StrictOriginMiddleware(BaseHTTPMiddleware):
    """Reads `settings.allowed_origins` fresh on every request (via
    get_settings(), not a value captured at middleware-construction time) —
    this keeps app.main importable without real environment variables
    present (e.g. for OpenAPI schema generation or static analysis),
    matching app/config.py's own "importing must never require secrets"
    convention; only handling an actual request requires Settings() to
    resolve successfully."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        allowed_origins = set(get_settings().allowed_origins)
        origin = request.headers.get("origin")
        if origin is not None and origin not in allowed_origins:
            request_id = request.headers.get("x-request-id") or "unknown"
            return JSONResponse(
                status_code=403,
                content={
                    "ok": False,
                    "error": {
                        "code": "origin_not_allowed",
                        "message": "This service does not accept browser-origin requests.",
                    },
                    "requestId": request_id,
                },
            )
        return await call_next(request)
