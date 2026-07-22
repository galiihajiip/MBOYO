"""Renders a BenchmarkReport + SelectionResult into a checked-in Markdown
report under ml/reports/ — per this block's "Produce a benchmark report"
requirement and docs/product/SUCCESS_METRICS.md's "evaluation report is
checked into ml/reports/ with dataset identity, date, and model version
recorded" convention (BLOCK 08/18's established pattern for
model_evaluation rows, applied here to the pre-training benchmark stage).
"""

from __future__ import annotations

from pathlib import Path

from .benchmark import BenchmarkReport
from .selection_rule import SelectionResult


def render_benchmark_report_markdown(report: BenchmarkReport, selection: SelectionResult) -> str:
    lines: list[str] = []
    lines.append(f"# MBOYO Model Benchmark Report — {report.experiment_name}")
    lines.append("")

    if report.is_smoke_test:
        lines.append(
            "**⚠️ SMOKE-TEST RUN — synthetic data, not a real benchmark.** "
            "Every number below was produced by a genuine training/evaluation run, "
            "but against a tiny, artificially-generated synthetic dataset "
            "(see `ml/src/training/smoke_test_data.py`), never real photographs. "
            "This report exists to prove the training/benchmark pipeline runs "
            "correctly end to end — it must never be cited as evidence of any "
            "architecture's real-world performance."
        )
        lines.append("")

    lines.append(f"**Generated at:** {report.generated_at}")
    lines.append(f"**Dataset manifest:** `{report.dataset_manifest_path}`")
    lines.append(
        f"**Split sizes:** train={report.train_count}, val={report.val_count}, "
        f"test={report.test_count}"
    )
    lines.append("")

    lines.append("## Phase 1 — Loss/Sampler Selection")
    lines.append("")
    lines.append(
        "Selected once at a single reference architecture/resolution "
        "(the cheapest candidate architecture), then carried into every "
        "architecture x resolution run in Phase 2 — see "
        "`ml/BENCHMARK_METHODOLOGY.md` for the full rationale."
    )
    lines.append("")
    lines.append("| Loss | Sampler | Validation macro-F1 |")
    lines.append("|---|---|---|")
    for loss_name, sampler_enabled, val_f1 in report.loss_selection.candidate_scores:
        lines.append(f"| {loss_name} | {sampler_enabled} | {val_f1:.4f} |")
    lines.append("")
    lines.append(
        f"**Winner:** `{report.loss_selection.winning_loss_name}`, "
        f"sampler={report.loss_selection.winning_sampler_enabled}"
    )
    lines.append("")

    lines.append("## Phase 2 — Architecture x Resolution Results")
    lines.append("")
    lines.append(
        "| Architecture | Resolution | Macro-F1 | Destroyed Recall | ECE | "
        "Abstention Rate | Latency p50/p95 (ms) | Checkpoint Size (MB) | "
        "Epochs Run | Stopped Early |"
    )
    lines.append("|---|---|---|---|---|---|---|---|---|---|")
    for result in report.architecture_results:
        destroyed_recall_str = (
            f"{result.test_metrics.destroyed_recall:.4f}"
            if result.test_metrics.destroyed_recall is not None
            else "N/A (no destroyed examples)"
        )
        checkpoint_mb = result.checkpoint_size_bytes / (1024 * 1024)
        lines.append(
            f"| {result.architecture} | {result.resolution_px}px | "
            f"{result.test_metrics.macro_f1:.4f} | {destroyed_recall_str} | "
            f"{result.calibration_error:.4f} | {result.abstention_rate:.4f} | "
            f"{result.latency.p50_ms:.1f} / {result.latency.p95_ms:.1f} | "
            f"{checkpoint_mb:.2f} | {result.epochs_run} | {result.stopped_early} |"
        )
    lines.append("")

    lines.append("### Per-Class Metrics")
    lines.append("")
    for result in report.architecture_results:
        lines.append(f"**{result.architecture} @ {result.resolution_px}px**")
        lines.append("")
        lines.append("| Class | Precision | Recall | F1 | Support |")
        lines.append("|---|---|---|---|---|")
        for per_class in result.test_metrics.per_class:
            lines.append(
                f"| {per_class.class_name} | {per_class.precision:.4f} | "
                f"{per_class.recall:.4f} | {per_class.f1:.4f} | {per_class.support} |"
            )
        lines.append("")

    lines.append("### Robustness to Image-Quality Degradation")
    lines.append("")
    lines.append(
        "| Architecture | Resolution | Degradation | Clean Macro-F1 | Degraded Macro-F1 | Drop |"
    )
    lines.append("|---|---|---|---|---|---|")
    for result in report.architecture_results:
        for robustness in result.robustness:
            lines.append(
                f"| {result.architecture} | {result.resolution_px}px | "
                f"{robustness.degradation_name} | {robustness.clean_macro_f1:.4f} | "
                f"{robustness.degraded_macro_f1:.4f} | {robustness.macro_f1_drop:+.4f} |"
            )
    lines.append("")

    lines.append("## Composite Selection Result")
    lines.append("")
    lines.append(
        "See `ml/src/training/selection_rule.py`'s module docstring and "
        "`ml/BENCHMARK_METHODOLOGY.md` for the full documented rule."
    )
    lines.append("")

    if selection.gate_failures:
        lines.append("### Excluded by hard gate")
        lines.append("")
        for failure in selection.gate_failures:
            lines.append(
                f"- **{failure.architecture} @ {failure.resolution_px}px**: {failure.reason}"
            )
        lines.append("")

    if selection.ranked_candidates:
        lines.append("### Ranked candidates (best first)")
        lines.append("")
        lines.append(
            "| Rank | Architecture | Resolution | Composite Score | Macro-F1 | "
            "Destroyed Recall | Calibration | Latency | Model Size | Robustness |"
        )
        lines.append("|---|---|---|---|---|---|---|---|---|---|")
        for rank, candidate in enumerate(selection.ranked_candidates, start=1):
            lines.append(
                f"| {rank} | {candidate.architecture} | {candidate.resolution_px}px | "
                f"{candidate.composite_score:.4f} | {candidate.macro_f1_component:.4f} | "
                f"{candidate.destroyed_recall_component:.4f} | "
                f"{candidate.calibration_component:.4f} | {candidate.latency_component:.4f} | "
                f"{candidate.model_size_component:.4f} | {candidate.robustness_component:.4f} |"
            )
        lines.append("")

    if selection.recommended is not None:
        lines.append(
            f"**Recommendation: `{selection.recommended.architecture}` @ "
            f"{selection.recommended.resolution_px}px** (composite score "
            f"{selection.recommended.composite_score:.4f})"
        )
    else:
        lines.append(
            "**No candidate passed the hard gates.** No recommendation can be made from this run."
        )
    lines.append("")

    return "\n".join(lines)


def write_benchmark_report(
    report: BenchmarkReport, selection: SelectionResult, reports_dir: Path, report_filename: str
) -> Path:
    reports_dir.mkdir(parents=True, exist_ok=True)
    report_path = reports_dir / report_filename
    report_path.write_text(render_benchmark_report_markdown(report, selection), encoding="utf-8")
    return report_path
