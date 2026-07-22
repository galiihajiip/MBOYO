"""Structured JSON logging for apps/ml-api (BLOCK 28).

Every log record becomes one JSON object on one line — mirrors
apps/worker/worker/logging_setup.py and apps/web's
lib/observability/logger.ts exactly (same redaction rules: secret/token/
key-shaped field names plus a fixed PII denylist, same "no external
logging library" posture — see OBSERVABILITY.md).

configure_json_logging() should be called once, at process startup
(app/main.py), before the first request is served.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import UTC, datetime
from typing import Any

_SENSITIVE_KEY_PATTERN = re.compile(
    r"password|token|secret|key|authorization|cookie|dsn", re.IGNORECASE
)
_PII_FIELD_NAMES = {"email", "phone", "phonenumber", "address", "sha256hash", "perceptualhash"}
_REDACTED = "[redacted]"

_STANDARD_LOG_RECORD_ATTRS = {
    "name", "msg", "args", "levelname", "levelno", "pathname", "filename", "module",
    "exc_info", "exc_text", "stack_info", "lineno", "funcName", "created", "msecs",
    "relativeCreated", "thread", "threadName", "processName", "process", "taskName",
}


def _redact(key: str, value: Any) -> Any:
    lower_key = key.lower()
    if _SENSITIVE_KEY_PATTERN.search(lower_key) or lower_key in _PII_FIELD_NAMES:
        return _REDACTED
    if isinstance(value, dict):
        return {k: _redact(k, v) for k, v in value.items()}
    if isinstance(value, (bytes, bytearray)):
        return f"[binary {len(value)} bytes omitted]"
    if isinstance(value, list):
        return [_redact(key, item) for item in value]
    return value


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        line: dict[str, Any] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname.lower(),
            "service": "apps/ml-api",
            "message": record.getMessage(),
        }

        for key, value in record.__dict__.items():
            if key in _STANDARD_LOG_RECORD_ATTRS or key.startswith("_"):
                continue
            try:
                line[key] = _redact(key, value)
            except Exception:
                line[key] = "[unserializable]"

        if record.exc_info:
            line["exception"] = self.formatException(record.exc_info)

        def _fallback(value: Any) -> str:
            try:
                return str(value)
            except Exception:
                return "[unserializable]"

        try:
            return json.dumps(line, default=_fallback)
        except Exception:
            return json.dumps(
                {
                    "timestamp": line["timestamp"],
                    "level": line["level"],
                    "service": line["service"],
                    "message": "[log line dropped: unserializable field]",
                }
            )


def configure_json_logging(level: int = logging.INFO) -> None:
    """Replaces the root logger's handlers with a single stdout
    StreamHandler using JsonFormatter — every existing
    getLogger(...).info(..., extra={...}) call in this package (app/main.py)
    is then rendered as structured JSON without any call-site change."""
    root = logging.getLogger()
    root.setLevel(level)
    for handler in list(root.handlers):
        root.removeHandler(handler)
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root.addHandler(handler)
