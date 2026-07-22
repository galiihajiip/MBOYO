from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from training.release_config import (
    ReleaseCriteriaConfigError,
    load_release_criteria,
)

VALID_CONFIG = {
    "macro_f1_min": 0.75,
    "destroyed_recall_min": 0.6,
    "calibration_error_max": 0.1,
    "min_test_set_sample_count": 30,
}


def _write_config(tmp_path: Path, overrides: dict[str, object] | None = None) -> Path:
    config = {**VALID_CONFIG, **(overrides or {})}
    path = tmp_path / "release_criteria.yaml"
    path.write_text(yaml.safe_dump(config), encoding="utf-8")
    return path


def test_loads_valid_config(tmp_path: Path) -> None:
    path = _write_config(tmp_path)
    criteria = load_release_criteria(path)
    assert criteria.macro_f1_min == pytest.approx(0.75)
    assert criteria.destroyed_recall_min == pytest.approx(0.6)
    assert criteria.calibration_error_max == pytest.approx(0.1)
    assert criteria.min_test_set_sample_count == 30


def test_missing_file_raises() -> None:
    with pytest.raises(ReleaseCriteriaConfigError, match="not found"):
        load_release_criteria(Path("/nonexistent/release_criteria.yaml"))


def test_missing_required_key_raises(tmp_path: Path) -> None:
    path = tmp_path / "release_criteria.yaml"
    path.write_text(yaml.safe_dump({"macro_f1_min": 0.75}), encoding="utf-8")
    with pytest.raises(ReleaseCriteriaConfigError, match="missing required key"):
        load_release_criteria(path)


def test_non_mapping_top_level_raises(tmp_path: Path) -> None:
    path = tmp_path / "release_criteria.yaml"
    path.write_text(yaml.safe_dump([1, 2, 3]), encoding="utf-8")
    with pytest.raises(ReleaseCriteriaConfigError, match="must be a mapping"):
        load_release_criteria(path)


def test_default_release_criteria_path_loads_the_real_repo_config() -> None:
    """The real ml/configs/release_criteria.yaml this block adds must itself
    be loadable — a config file that only works in tests would defeat the
    purpose."""
    from training.release_config import DEFAULT_RELEASE_CRITERIA_PATH

    criteria = load_release_criteria(DEFAULT_RELEASE_CRITERIA_PATH)
    assert 0.0 <= criteria.macro_f1_min <= 1.0
    assert 0.0 <= criteria.destroyed_recall_min <= 1.0
    assert 0.0 <= criteria.calibration_error_max <= 1.0
    assert criteria.min_test_set_sample_count > 0
