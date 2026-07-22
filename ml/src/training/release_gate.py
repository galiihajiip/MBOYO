"""The release gate — decides whether a single chosen model's
untouched-test-set evaluation clears docs/product/SUCCESS_METRICS.md's
Release Gate thresholds (ml/configs/release_criteria.yaml). This is
distinct from selection_rule.py's architecture-selection gates (which
choose the best of several benchmark candidates); release_gate.py makes
a promote/advisory-only decision about ONE already-chosen model's real
evaluation, mirroring model_registry_entries.is_active /
model_predictions.is_advisory_only in the Supabase schema.

Per SUCCESS_METRICS.md's Advisory-Only Fallback: failing gates does not
block inference — apps/ml-api may still serve the model, but every
prediction it produces must be labeled advisory-only, and the Verifier's
decision authority is never bypassed or pre-filled based on its output.
This module only decides the promote/advisory label; it does not gate
inference itself.

All three thresholds must pass — gates are never traded off against each
other, matching selection_rule.py's "hard gates first" precedent.
"""

from __future__ import annotations

from dataclasses import dataclass

from .metrics import ClassificationMetrics
from .release_config import ReleaseCriteria


@dataclass(frozen=True)
class ReleaseGateResult:
    passed: bool
    is_advisory_only: bool
    failure_reasons: tuple[str, ...]
    macro_f1: float
    destroyed_recall: float | None
    calibration_error: float
    sample_count: int


def evaluate_release_gate(
    metrics: ClassificationMetrics,
    calibration_error: float,
    criteria: ReleaseCriteria,
) -> ReleaseGateResult:
    """`metrics` and `calibration_error` MUST come from the untouched test
    split's evaluation — this function has no way to verify that itself
    (it only receives numbers), so the caller (evaluate.py) is responsible
    for never passing validation/training-split metrics here, per this
    block's explicit "never evaluate on training or validation data as
    final evidence" requirement."""
    reasons: list[str] = []

    if metrics.sample_count < criteria.min_test_set_sample_count:
        reasons.append(
            f"test set has only {metrics.sample_count} samples, below the minimum "
            f"{criteria.min_test_set_sample_count} required to trust a release decision"
        )

    if metrics.macro_f1 < criteria.macro_f1_min:
        reasons.append(
            f"macro_f1 {metrics.macro_f1:.4f} below required minimum {criteria.macro_f1_min:.4f}"
        )

    if metrics.destroyed_recall is None:
        reasons.append(
            "destroyed_recall could not be computed (no destroyed-class examples in the test set)"
        )
    elif metrics.destroyed_recall < criteria.destroyed_recall_min:
        reasons.append(
            f"destroyed_recall {metrics.destroyed_recall:.4f} below required minimum "
            f"{criteria.destroyed_recall_min:.4f}"
        )

    if calibration_error > criteria.calibration_error_max:
        reasons.append(
            f"calibration_error {calibration_error:.4f} exceeds allowed maximum "
            f"{criteria.calibration_error_max:.4f}"
        )

    passed = len(reasons) == 0
    return ReleaseGateResult(
        passed=passed,
        is_advisory_only=not passed,
        failure_reasons=tuple(reasons),
        macro_f1=metrics.macro_f1,
        destroyed_recall=metrics.destroyed_recall,
        calibration_error=calibration_error,
        sample_count=metrics.sample_count,
    )
