"""Experiment logging — an append-only, one-line-per-event JSON Lines log per
run, recording every epoch's train/validation metrics. This is the record a
benchmark report is built from; nothing in the report is computed from
memory alone without also being durably logged, so a run's full history
survives a crash and can be inspected independently of the final report.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class EpochLogEntry:
    run_id: str
    epoch: int
    phase: str  # "train" | "val"
    loss: float
    macro_f1: float | None
    accuracy: float | None
    logged_at: str


class ExperimentLogger:
    def __init__(self, log_path: Path, run_id: str) -> None:
        self._log_path = log_path
        self._run_id = run_id
        log_path.parent.mkdir(parents=True, exist_ok=True)

    def log_epoch(
        self,
        epoch: int,
        phase: str,
        loss: float,
        macro_f1: float | None = None,
        accuracy: float | None = None,
    ) -> None:
        entry = EpochLogEntry(
            run_id=self._run_id,
            epoch=epoch,
            phase=phase,
            loss=loss,
            macro_f1=macro_f1,
            accuracy=accuracy,
            logged_at=datetime.now(UTC).isoformat(),
        )
        self._append(asdict(entry))

    def log_event(self, event: str, detail: dict[str, Any]) -> None:
        """For non-epoch events (run started, early stopped, checkpoint saved)
        — kept in the same log file so a run's full timeline is in one place,
        not scattered across multiple log files a reader has to correlate by
        timestamp."""
        payload = {
            "run_id": self._run_id,
            "event": event,
            "detail": detail,
            "logged_at": datetime.now(UTC).isoformat(),
        }
        self._append(payload)

    def _append(self, payload: dict[str, Any]) -> None:
        with self._log_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(payload) + "\n")


def read_log_entries(log_path: Path) -> list[dict[str, Any]]:
    """Reads back a JSON Lines log — returns an empty list (not an error) for
    a missing file, matching this project's established "empty data is a
    valid, non-error state" convention (BLOCK 18)."""
    if not log_path.exists():
        return []
    entries = []
    with log_path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if line:
                entries.append(json.loads(line))
    return entries
