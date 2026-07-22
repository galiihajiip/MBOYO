from __future__ import annotations

from training.benchmark import (
    ArchitectureBenchmarkResult,
    BenchmarkReport,
    LossSelectionResult,
    RobustnessResult,
)
from training.latency import LatencyMeasurement
from training.metrics import ClassificationMetrics, PerClassMetrics
from training.selection_rule import (
    MAX_ACCEPTABLE_P95_LATENCY_MS,
    MIN_ACCEPTABLE_DESTROYED_RECALL,
    apply_selection_rule,
)

CLASSES = ("no_damage", "minor_damage", "major_damage", "destroyed", "unknown")


def _make_metrics(macro_f1: float, destroyed_recall: float | None) -> ClassificationMetrics:
    return ClassificationMetrics(
        macro_f1=macro_f1,
        destroyed_recall=destroyed_recall,
        per_class=tuple(
            PerClassMetrics(class_name=c, precision=0.5, recall=0.5, f1=0.5, support=1)
            for c in CLASSES
        ),
        accuracy=macro_f1,
        sample_count=10,
    )


def _make_result(
    architecture: str,
    resolution_px: int,
    macro_f1: float,
    destroyed_recall: float | None,
    p95_latency_ms: float,
    calibration_error: float = 0.1,
    checkpoint_size_bytes: int = 1_000_000,
    robustness: tuple[RobustnessResult, ...] = (),
) -> ArchitectureBenchmarkResult:
    return ArchitectureBenchmarkResult(
        architecture=architecture,
        resolution_px=resolution_px,
        test_metrics=_make_metrics(macro_f1, destroyed_recall),
        calibration_error=calibration_error,
        abstention_rate=0.1,
        latency=LatencyMeasurement(
            p50_ms=p95_latency_ms * 0.8,
            p95_ms=p95_latency_ms,
            p99_ms=p95_latency_ms * 1.1,
            mean_ms=p95_latency_ms * 0.85,
            sample_count=30,
            batch_size=1,
            resolution_px=resolution_px,
        ),
        model_size_bytes_estimate=checkpoint_size_bytes,
        checkpoint_size_bytes=checkpoint_size_bytes,
        robustness=robustness,
        best_epoch=1,
        stopped_early=False,
        epochs_run=2,
    )


def _make_report(results: tuple[ArchitectureBenchmarkResult, ...]) -> BenchmarkReport:
    return BenchmarkReport(
        generated_at="2026-07-19T00:00:00Z",
        experiment_name="test",
        is_smoke_test=True,
        loss_selection=LossSelectionResult(
            winning_loss_name="cross_entropy",
            winning_sampler_enabled=False,
            candidate_scores=(("cross_entropy", False, 0.5),),
        ),
        architecture_results=results,
        dataset_manifest_path="test.csv",
        train_count=10,
        val_count=5,
        test_count=5,
    )


def test_candidate_failing_destroyed_recall_gate_is_excluded() -> None:
    report = _make_report(
        (
            _make_result(
                "mobilenet_v3_large",
                224,
                macro_f1=0.9,
                destroyed_recall=MIN_ACCEPTABLE_DESTROYED_RECALL - 0.1,
                p95_latency_ms=100,
            ),
        )
    )
    selection = apply_selection_rule(report)
    assert selection.recommended is None
    assert len(selection.gate_failures) == 1
    assert "destroyed_recall" in selection.gate_failures[0].reason


def test_candidate_with_none_destroyed_recall_fails_gate() -> None:
    report = _make_report(
        (
            _make_result(
                "mobilenet_v3_large", 224, macro_f1=0.9, destroyed_recall=None, p95_latency_ms=100
            ),
        )
    )
    selection = apply_selection_rule(report)
    assert selection.recommended is None
    assert "could not be computed" in selection.gate_failures[0].reason


def test_candidate_failing_latency_gate_is_excluded() -> None:
    report = _make_report(
        (
            _make_result(
                "mobilenet_v3_large",
                224,
                macro_f1=0.9,
                destroyed_recall=0.9,
                p95_latency_ms=MAX_ACCEPTABLE_P95_LATENCY_MS + 500,
            ),
        )
    )
    selection = apply_selection_rule(report)
    assert selection.recommended is None
    assert "latency" in selection.gate_failures[0].reason


def test_gate_passing_candidate_is_recommended() -> None:
    report = _make_report(
        (
            _make_result(
                "mobilenet_v3_large", 224, macro_f1=0.9, destroyed_recall=0.9, p95_latency_ms=100
            ),
        )
    )
    selection = apply_selection_rule(report)
    assert selection.recommended is not None
    assert selection.recommended.architecture == "mobilenet_v3_large"
    assert len(selection.gate_failures) == 0


def test_higher_macro_f1_ranks_first_among_gate_passing_candidates() -> None:
    report = _make_report(
        (
            _make_result(
                "mobilenet_v3_large", 224, macro_f1=0.6, destroyed_recall=0.9, p95_latency_ms=100
            ),
            _make_result(
                "convnext_tiny", 224, macro_f1=0.9, destroyed_recall=0.9, p95_latency_ms=100
            ),
        )
    )
    selection = apply_selection_rule(report)
    assert selection.recommended is not None
    assert selection.recommended.architecture == "convnext_tiny"
    assert selection.ranked_candidates[0].architecture == "convnext_tiny"
    assert selection.ranked_candidates[1].architecture == "mobilenet_v3_large"


def test_faster_candidate_wins_when_accuracy_is_equal() -> None:
    report = _make_report(
        (
            _make_result(
                "mobilenet_v3_large", 224, macro_f1=0.8, destroyed_recall=0.8, p95_latency_ms=50
            ),
            _make_result(
                "convnext_tiny", 224, macro_f1=0.8, destroyed_recall=0.8, p95_latency_ms=500
            ),
        )
    )
    selection = apply_selection_rule(report)
    assert selection.recommended is not None
    assert selection.recommended.architecture == "mobilenet_v3_large"


def test_all_candidates_failing_gates_yields_no_recommendation() -> None:
    report = _make_report(
        (
            _make_result(
                "mobilenet_v3_large", 224, macro_f1=0.9, destroyed_recall=0.1, p95_latency_ms=100
            ),
            _make_result(
                "convnext_tiny", 224, macro_f1=0.9, destroyed_recall=0.1, p95_latency_ms=100
            ),
        )
    )
    selection = apply_selection_rule(report)
    assert selection.recommended is None
    assert selection.ranked_candidates == ()
    assert len(selection.gate_failures) == 2


def test_robustness_penalizes_large_macro_f1_drop() -> None:
    stable_result = _make_result(
        "mobilenet_v3_large",
        224,
        macro_f1=0.8,
        destroyed_recall=0.8,
        p95_latency_ms=100,
        robustness=(RobustnessResult("gaussian_blur", 0.8, 0.79, 0.01),),
    )
    fragile_result = _make_result(
        "convnext_tiny",
        224,
        macro_f1=0.8,
        destroyed_recall=0.8,
        p95_latency_ms=100,
        robustness=(RobustnessResult("gaussian_blur", 0.8, 0.2, 0.6),),
    )
    report = _make_report((stable_result, fragile_result))
    selection = apply_selection_rule(report)
    assert selection.recommended is not None
    assert selection.recommended.architecture == "mobilenet_v3_large"
