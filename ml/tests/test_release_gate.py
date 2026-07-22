from __future__ import annotations

from training.metrics import ClassificationMetrics, PerClassMetrics
from training.release_config import ReleaseCriteria
from training.release_gate import evaluate_release_gate

CLASSES = ("no_damage", "minor_damage", "major_damage", "destroyed", "unknown")

CRITERIA = ReleaseCriteria(
    macro_f1_min=0.75,
    destroyed_recall_min=0.6,
    calibration_error_max=0.1,
    min_test_set_sample_count=30,
)


def _metrics(
    macro_f1: float, destroyed_recall: float | None, sample_count: int = 50
) -> ClassificationMetrics:
    return ClassificationMetrics(
        macro_f1=macro_f1,
        destroyed_recall=destroyed_recall,
        per_class=tuple(
            PerClassMetrics(class_name=c, precision=0.8, recall=0.8, f1=0.8, support=10)
            for c in CLASSES
        ),
        accuracy=macro_f1,
        sample_count=sample_count,
    )


def test_passing_model_is_promoted_not_advisory() -> None:
    result = evaluate_release_gate(_metrics(0.9, 0.8), calibration_error=0.05, criteria=CRITERIA)
    assert result.passed is True
    assert result.is_advisory_only is False
    assert result.failure_reasons == ()


def test_low_macro_f1_fails_gate() -> None:
    result = evaluate_release_gate(_metrics(0.5, 0.8), calibration_error=0.05, criteria=CRITERIA)
    assert result.passed is False
    assert result.is_advisory_only is True
    assert any("macro_f1" in reason for reason in result.failure_reasons)


def test_low_destroyed_recall_fails_gate() -> None:
    result = evaluate_release_gate(_metrics(0.9, 0.3), calibration_error=0.05, criteria=CRITERIA)
    assert result.passed is False
    assert any("destroyed_recall" in reason for reason in result.failure_reasons)


def test_none_destroyed_recall_fails_gate() -> None:
    result = evaluate_release_gate(_metrics(0.9, None), calibration_error=0.05, criteria=CRITERIA)
    assert result.passed is False
    assert any("could not be computed" in reason for reason in result.failure_reasons)


def test_high_calibration_error_fails_gate() -> None:
    result = evaluate_release_gate(_metrics(0.9, 0.8), calibration_error=0.5, criteria=CRITERIA)
    assert result.passed is False
    assert any("calibration_error" in reason for reason in result.failure_reasons)


def test_too_few_test_samples_fails_gate_even_with_good_metrics() -> None:
    result = evaluate_release_gate(
        _metrics(0.95, 0.95, sample_count=5), calibration_error=0.01, criteria=CRITERIA
    )
    assert result.passed is False
    assert any("only 5 samples" in reason for reason in result.failure_reasons)


def test_multiple_failures_are_all_reported_not_just_the_first() -> None:
    result = evaluate_release_gate(_metrics(0.2, 0.1), calibration_error=0.9, criteria=CRITERIA)
    assert len(result.failure_reasons) == 3


def test_result_carries_through_the_input_metrics() -> None:
    result = evaluate_release_gate(_metrics(0.9, 0.8), calibration_error=0.05, criteria=CRITERIA)
    assert result.macro_f1 == 0.9
    assert result.destroyed_recall == 0.8
    assert result.calibration_error == 0.05
    assert result.sample_count == 50
