"""Correlation ID handling — mirrors apps/web's lib/api/request-id.ts
exactly (same header name, same mint-or-echo semantics), so a request
traced through apps/web -> apps/worker -> apps/ml-api keeps one correlation
ID across all three languages/processes, per
docs/product/PRODUCTION_SCOPE.md's "structured logging... with correlation
IDs that let an Auditor or System Administrator trace a report through
analysis" requirement.
"""

from __future__ import annotations

import uuid

from fastapi import Header

REQUEST_ID_HEADER = "x-request-id"


def resolve_request_id(
    x_request_id: str | None = Header(default=None, alias=REQUEST_ID_HEADER),
) -> str:
    return x_request_id or str(uuid.uuid4())
