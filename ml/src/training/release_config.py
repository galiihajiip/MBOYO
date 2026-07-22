"""Loads ml/configs/release_criteria.yaml — the release-gate thresholds
SUCCESS_METRICS.md's Release Gate section defers to "the current
ml/configs/ release criteria file." Kept as its own small config module
(not folded into TrainingConfig) since release-gating is a distinct
concern from training/benchmarking: a release decision is made once, on a
single chosen model's untouched-test-set evaluation, not per training run.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

DEFAULT_RELEASE_CRITERIA_PATH = (
    Path(__file__).resolve().parent.parent.parent / "configs" / "release_criteria.yaml"
)


class ReleaseCriteriaConfigError(ValueError):
    """Raised when release_criteria.yaml is missing or malformed."""


@dataclass(frozen=True)
class ReleaseCriteria:
    macro_f1_min: float
    destroyed_recall_min: float
    calibration_error_max: float
    min_test_set_sample_count: int


def _require(data: dict[str, Any], key: str, config_path: Path) -> Any:  # noqa: ANN401
    if key not in data:
        raise ReleaseCriteriaConfigError(f"{config_path}: missing required key '{key}'")
    return data[key]


def load_release_criteria(
    config_path: Path = DEFAULT_RELEASE_CRITERIA_PATH,
) -> ReleaseCriteria:
    if not config_path.exists():
        raise ReleaseCriteriaConfigError(f"Release criteria config not found at {config_path}")

    with config_path.open("r", encoding="utf-8") as handle:
        raw = yaml.safe_load(handle)

    if not isinstance(raw, dict):
        raise ReleaseCriteriaConfigError(f"{config_path}: top level must be a mapping")

    return ReleaseCriteria(
        macro_f1_min=float(_require(raw, "macro_f1_min", config_path)),
        destroyed_recall_min=float(_require(raw, "destroyed_recall_min", config_path)),
        calibration_error_max=float(_require(raw, "calibration_error_max", config_path)),
        min_test_set_sample_count=int(_require(raw, "min_test_set_sample_count", config_path)),
    )
