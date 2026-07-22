from __future__ import annotations

import uuid

from app.request_context import REQUEST_ID_HEADER, resolve_request_id


def test_echoes_an_inbound_request_id() -> None:
    assert resolve_request_id(x_request_id="req-123") == "req-123"


def test_mints_a_uuid_when_absent() -> None:
    request_id = resolve_request_id(x_request_id=None)
    # Raises ValueError if not a valid UUID string — the assertion itself.
    parsed = uuid.UUID(request_id)
    assert str(parsed) == request_id


def test_mints_a_different_uuid_on_each_call() -> None:
    first = resolve_request_id(x_request_id=None)
    second = resolve_request_id(x_request_id=None)
    assert first != second


def test_header_constant_matches_the_documented_header_name() -> None:
    assert REQUEST_ID_HEADER == "x-request-id"


def test_empty_string_header_mints_a_uuid_rather_than_echoing_blank() -> None:
    request_id = resolve_request_id(x_request_id="")
    assert request_id != ""
    uuid.UUID(request_id)
