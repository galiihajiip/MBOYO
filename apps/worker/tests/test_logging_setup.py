from __future__ import annotations

import json
import logging

from worker.logging_setup import JsonFormatter


def _format_record(**extra: object) -> dict[str, object]:
    record = logging.LogRecord(
        name="mboyo.worker.test",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="something happened",
        args=(),
        exc_info=None,
    )
    for key, value in extra.items():
        setattr(record, key, value)
    formatted = JsonFormatter().format(record)
    parsed: dict[str, object] = json.loads(formatted)
    return parsed


def test_emits_expected_top_level_fields() -> None:
    parsed = _format_record(job_id="job-1")
    assert parsed["level"] == "info"
    assert parsed["service"] == "apps/worker"
    assert parsed["message"] == "something happened"
    assert parsed["job_id"] == "job-1"
    assert isinstance(parsed["timestamp"], str)


def test_redacts_secret_shaped_field_names() -> None:
    parsed = _format_record(
        password="hunter2", ml_internal_token="abc", supabase_service_role_key="k"
    )
    assert parsed["password"] == "[redacted]"
    assert parsed["ml_internal_token"] == "[redacted]"
    assert parsed["supabase_service_role_key"] == "[redacted]"


def test_redacts_known_pii_field_names() -> None:
    parsed = _format_record(email="user@example.com", report_id="r1")
    assert parsed["email"] == "[redacted]"
    assert parsed["report_id"] == "r1"


def test_redacts_nested_dict_fields() -> None:
    parsed = _format_record(actor={"profile_id": "p1", "email": "user@example.com"})
    assert parsed["actor"] == {"profile_id": "p1", "email": "[redacted]"}


def test_strips_raw_bytes_instead_of_logging_them() -> None:
    parsed = _format_record(image_bytes=b"\x00\x01\x02")
    assert parsed["image_bytes"] == "[binary 3 bytes omitted]"


def test_does_not_crash_on_unserializable_value() -> None:
    class Unserializable:
        def __repr__(self) -> str:
            raise RuntimeError("boom")

    parsed = _format_record(weird=Unserializable())
    assert "weird" in parsed
