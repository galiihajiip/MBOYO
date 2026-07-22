from __future__ import annotations

from pathlib import Path

from training.calibration import PerClassThresholds
from training.evaluate import UntouchedTestEvaluationReport
from training.evaluation_report import render_evaluation_report_markdown, write_evaluation_report
from training.metrics import ClassificationMetrics, ConfusionMatrix, PerClassMetrics
from training.release_config import ReleaseCriteria
from training.release_gate import evaluate_release_gate

CLASSES = ("no_damage", "minor_damage", "major_damage", "destroyed", "unknown")


def _report(
    macro_f1: float = 0.9, destroyed_recall: float | None = 0.8
) -> UntouchedTestEvaluationReport:
    metrics = ClassificationMetrics(
        macro_f1=macro_f1,
        destroyed_recall=destroyed_recall,
        per_class=tuple(
            PerClassMetrics(class_name=c, precision=0.8, recall=0.8, f1=0.8, support=5)
            for c in CLASSES
        ),
        accuracy=macro_f1,
        sample_count=25,
        micro_f1=macro_f1,
        weighted_f1=macro_f1,
    )
    confusion = ConfusionMatrix(
        classes=CLASSES, matrix=tuple(tuple(5 if i == j else 0 for j in range(5)) for i in range(5))
    )
    return UntouchedTestEvaluationReport(
        generated_at="2026-07-19T00:00:00Z",
        dataset_identity="test-dataset",
        classes=CLASSES,
        test_sample_count=25,
        temperature=1.2,
        per_class_thresholds=PerClassThresholds(thresholds=dict.fromkeys(CLASSES, 0.5)),
        metrics=metrics,
        confusion_matrix=confusion,
        precision_recall_curves=(),
        calibration_curve=(),
        calibration_error=0.05,
        abstention_rate=0.1,
        per_sample_abstention_reason_counts={"low_confidence": 2},
    )


CRITERIA = ReleaseCriteria(
    macro_f1_min=0.75,
    destroyed_recall_min=0.6,
    calibration_error_max=0.1,
    min_test_set_sample_count=10,
)


def test_render_passing_gate_shows_passed_verdict() -> None:
    report = _report()
    gate_result = evaluate_release_gate(report.metrics, report.calibration_error, CRITERIA)
    markdown = render_evaluation_report_markdown(report, gate_result)
    assert "**PASSED**" in markdown
    assert "ADVISORY ONLY" not in markdown


def test_render_failing_gate_shows_advisory_only_and_reasons() -> None:
    report = _report(macro_f1=0.3, destroyed_recall=0.1)
    gate_result = evaluate_release_gate(report.metrics, report.calibration_error, CRITERIA)
    markdown = render_evaluation_report_markdown(report, gate_result)
    assert "ADVISORY ONLY" in markdown
    assert "belum lolos ambang evaluasi" in markdown
    assert "macro_f1" in markdown


def test_render_includes_confusion_matrix_and_per_class_table() -> None:
    report = _report()
    gate_result = evaluate_release_gate(report.metrics, report.calibration_error, CRITERIA)
    markdown = render_evaluation_report_markdown(report, gate_result)
    for class_name in CLASSES:
        assert class_name in markdown


def test_render_includes_abstention_reason_counts() -> None:
    report = _report()
    gate_result = evaluate_release_gate(report.metrics, report.calibration_error, CRITERIA)
    markdown = render_evaluation_report_markdown(report, gate_result)
    assert "low_confidence" in markdown
    assert "2 test samples" in markdown


def test_write_evaluation_report_creates_file(tmp_path: Path) -> None:
    report = _report()
    gate_result = evaluate_release_gate(report.metrics, report.calibration_error, CRITERIA)
    output_path = write_evaluation_report(report, gate_result, tmp_path / "reports", "eval.md")
    assert output_path.exists()
    assert output_path.read_text(encoding="utf-8").startswith("# Untouched Test-Set Evaluation")
