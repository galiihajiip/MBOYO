from __future__ import annotations

from pathlib import Path

from training.experiment_log import ExperimentLogger, read_log_entries


def test_log_epoch_appends_readable_entries(tmp_path: Path) -> None:
    log_path = tmp_path / "log.jsonl"
    logger = ExperimentLogger(log_path, run_id="run-1")

    logger.log_epoch(0, "train", loss=0.5, accuracy=0.8)
    logger.log_epoch(0, "val", loss=0.6, macro_f1=0.7, accuracy=0.75)

    entries = read_log_entries(log_path)
    assert len(entries) == 2
    assert entries[0]["phase"] == "train"
    assert entries[0]["loss"] == 0.5
    assert entries[1]["phase"] == "val"
    assert entries[1]["macro_f1"] == 0.7


def test_log_event_records_arbitrary_detail(tmp_path: Path) -> None:
    log_path = tmp_path / "log.jsonl"
    logger = ExperimentLogger(log_path, run_id="run-1")

    logger.log_event("early_stopped", {"epoch": 5, "best_epoch": 2})

    entries = read_log_entries(log_path)
    assert len(entries) == 1
    assert entries[0]["event"] == "early_stopped"
    assert entries[0]["detail"]["epoch"] == 5


def test_read_log_entries_returns_empty_list_for_missing_file(tmp_path: Path) -> None:
    assert read_log_entries(tmp_path / "does-not-exist.jsonl") == []


def test_log_is_append_only_across_multiple_loggers(tmp_path: Path) -> None:
    log_path = tmp_path / "log.jsonl"
    ExperimentLogger(log_path, run_id="run-1").log_event("first", {})
    ExperimentLogger(log_path, run_id="run-1").log_event("second", {})

    entries = read_log_entries(log_path)
    assert len(entries) == 2
    assert entries[0]["event"] == "first"
    assert entries[1]["event"] == "second"
