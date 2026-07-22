"""Renders an UntouchedTestEvaluationReport (evaluate.py) plus a
ReleaseGateResult (release_gate.py) into Markdown — mirrors report.py's
role for the BLOCK 19 benchmark report, kept as a separate module since
this report's content (confusion matrix, PR/calibration curves, release
gate verdict) is a distinct concept from the architecture benchmark.
"""

from __future__ import annotations

from pathlib import Path

from .evaluate import UntouchedTestEvaluationReport
from .release_gate import ReleaseGateResult


def _render_confusion_matrix_table(report: UntouchedTestEvaluationReport) -> str:
    classes = report.confusion_matrix.classes
    header = "| True vs. Predicted | " + " | ".join(classes) + " |"
    separator = "|---" * (len(classes) + 1) + "|"
    rows = []
    for i, class_name in enumerate(classes):
        row_values = " | ".join(str(v) for v in report.confusion_matrix.matrix[i])
        rows.append(f"| **{class_name}** | {row_values} |")
    return "\n".join([header, separator, *rows])


def _render_per_class_table(report: UntouchedTestEvaluationReport) -> str:
    lines = [
        "| Class | Precision | Recall | F1 | Support | Confidence threshold |",
        "|---|---|---|---|---|---|",
    ]
    for pc in report.metrics.per_class:
        threshold = report.per_class_thresholds.thresholds.get(pc.class_name, float("nan"))
        lines.append(
            f"| {pc.class_name} | {pc.precision:.3f} | {pc.recall:.3f} | {pc.f1:.3f} | "
            f"{pc.support} | {threshold:.3f} |"
        )
    return "\n".join(lines)


def _render_calibration_curve_table(report: UntouchedTestEvaluationReport) -> str:
    if not report.calibration_curve:
        return "_No calibration curve points (empty test set bins)._"
    lines = ["| Bin | Mean confidence | Accuracy | Sample count |", "|---|---|---|---|"]
    for point in report.calibration_curve:
        lines.append(
            f"| [{point.bin_lower:.2f}, {point.bin_upper:.2f}] | {point.mean_confidence:.3f} | "
            f"{point.accuracy:.3f} | {point.sample_count} |"
        )
    return "\n".join(lines)


def render_evaluation_report_markdown(
    report: UntouchedTestEvaluationReport, gate_result: ReleaseGateResult
) -> str:
    lines: list[str] = []
    lines.append(f"# Untouched Test-Set Evaluation — {report.dataset_identity}")
    lines.append("")
    lines.append(
        f"Generated at: {report.generated_at} | Test samples: {report.test_sample_count} | "
        f"Classes: {', '.join(report.classes)}"
    )
    lines.append("")
    lines.append(
        "**This report is computed exclusively on the untouched test split.** "
        "Calibration (temperature scaling, per-class thresholds) was fit on the "
        "validation split only, per AGENTS.md's ML honesty rules — this evaluation "
        "is never used as the split that tunes any model or calibration parameter."
    )
    lines.append("")

    lines.append("## Release Gate")
    lines.append("")
    if gate_result.passed:
        lines.append(
            "**PASSED** — this model meets `ml/configs/release_criteria.yaml`'s thresholds "
            "and may be promoted to the active serving model."
        )
    else:
        lines.append(
            "**FAILED — ADVISORY ONLY.** Per docs/product/SUCCESS_METRICS.md's "
            "Advisory-Only Fallback, this model may still run inference, but every "
            "prediction must be labeled advisory-only in the Verifier UI "
            "('belum lolos ambang evaluasi — gunakan sebagai referensi, bukan keputusan'). "
            "The Verifier's decision authority is never bypassed based on this output."
        )
        lines.append("")
        lines.append("Failure reasons:")
        for reason in gate_result.failure_reasons:
            lines.append(f"- {reason}")
    lines.append("")

    destroyed_recall_text = (
        "N/A (no destroyed examples in test set)"
        if report.metrics.destroyed_recall is None
        else f"{report.metrics.destroyed_recall:.4f}"
    )
    lines.append("## Classification Metrics")
    lines.append("")
    lines.append(
        f"- Macro-F1: {report.metrics.macro_f1:.4f}\n"
        f"- Micro-F1: {report.metrics.micro_f1:.4f}\n"
        f"- Weighted-F1: {report.metrics.weighted_f1:.4f}\n"
        f"- Accuracy: {report.metrics.accuracy:.4f}\n"
        f"- Destroyed recall: {destroyed_recall_text}\n"
        f"- Calibration error (ECE): {report.calibration_error:.4f}\n"
        f"- Abstention rate (global threshold): {report.abstention_rate:.4f}\n"
        f"- Fitted temperature: {report.temperature:.4f}"
    )
    lines.append("")

    lines.append("### Per-Class Metrics and Fitted Thresholds")
    lines.append("")
    lines.append(_render_per_class_table(report))
    lines.append("")

    lines.append("## Confusion Matrix")
    lines.append("")
    lines.append(_render_confusion_matrix_table(report))
    lines.append("")

    lines.append("## Calibration Curve (Reliability Diagram)")
    lines.append("")
    lines.append(_render_calibration_curve_table(report))
    lines.append("")

    lines.append("## Per-Sample Abstention Signals")
    lines.append("")
    if report.per_sample_abstention_reason_counts:
        for reason, count in sorted(report.per_sample_abstention_reason_counts.items()):
            lines.append(f"- `{reason}`: {count} test samples")
    else:
        lines.append("_No test sample triggered any abstention signal._")
    lines.append("")

    lines.append("## Precision-Recall Curves")
    lines.append("")
    lines.append(
        "One-vs-rest PR curve per class is available in the machine-readable "
        "evaluation artifact (not rendered as a table here — each curve has "
        "many threshold points); see the accompanying JSON export."
    )
    lines.append("")

    return "\n".join(lines)


def write_evaluation_report(
    report: UntouchedTestEvaluationReport,
    gate_result: ReleaseGateResult,
    reports_dir: Path,
    report_filename: str,
) -> Path:
    reports_dir.mkdir(parents=True, exist_ok=True)
    output_path = reports_dir / report_filename
    output_path.write_text(render_evaluation_report_markdown(report, gate_result), encoding="utf-8")
    return output_path
