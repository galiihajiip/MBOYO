"""The composite selection rule — turns a BenchmarkReport's per-architecture
results into a single ranked recommendation, documented here (and restated
in the generated benchmark report) so the rule is auditable, not an opaque
"trust me" ranking.

Design rationale (the "documented composite selection rule" this block
requires):

1. HARD GATES FIRST, never traded off against a good score elsewhere.
   A candidate that fails a hard gate is excluded from ranking entirely,
   regardless of how good its other numbers are — this mirrors
   docs/product/SUCCESS_METRICS.md's release gate philosophy ("this gate
   cannot be waived by a strong macro-F1 alone") applied to architecture
   selection specifically:
     - destroyed_recall must not be None (the destroyed class must have
       been evaluable at all) and must not fall below
       MIN_ACCEPTABLE_DESTROYED_RECALL.
     - CPU p95 latency must not exceed MAX_ACCEPTABLE_P95_LATENCY_MS —
       an architecture too slow for docs/product/SUCCESS_METRICS.md's CPU
       p95 inference latency metric is unusable regardless of accuracy.

2. COMPOSITE SCORE among gate-passing candidates — a weighted sum of
   normalized (0..1, higher-is-better) sub-scores:
     - macro_f1 (weight 0.40) — the primary release-gate metric.
     - destroyed_recall (weight 0.25) — tracked separately per
       SUCCESS_METRICS.md's own rationale ("averaging can mask poor
       performance on this single highest-stakes class").
     - calibration (weight 0.15, computed as 1 - min(ece, 1)) — a
       miscalibrated model undermines Verifier trust even at high accuracy.
     - latency (weight 0.10, normalized against the gate-passing
       candidates' own latency range) — faster is better once already fast
       enough to pass the hard gate.
     - model_size (weight 0.05, same relative normalization) — smaller is
       operationally easier to deploy/update, but the least
       accuracy-relevant factor, hence the smallest weight.
     - robustness (weight 0.05, computed as 1 - mean(macro_f1_drop across
       degradations, clamped to [0,1])) — a model that degrades badly under
       realistic poor-image-quality conditions (RISK_REGISTER.md risk #4)
       is penalized, but lightly, since this is a secondary signal to the
       primary accuracy metrics above.

These weights are a documented, defensible starting point — not derived
from data (no real benchmark has been run yet) and not claimed to be
optimal; a future block with real evaluation data may revisit them, and
should do so explicitly rather than silently.
"""

from __future__ import annotations

from dataclasses import dataclass

from .benchmark import ArchitectureBenchmarkResult, BenchmarkReport

MIN_ACCEPTABLE_DESTROYED_RECALL = 0.5
MAX_ACCEPTABLE_P95_LATENCY_MS = 2000.0

WEIGHT_MACRO_F1 = 0.40
WEIGHT_DESTROYED_RECALL = 0.25
WEIGHT_CALIBRATION = 0.15
WEIGHT_LATENCY = 0.10
WEIGHT_MODEL_SIZE = 0.05
WEIGHT_ROBUSTNESS = 0.05


@dataclass(frozen=True)
class GateFailure:
    architecture: str
    resolution_px: int
    reason: str


@dataclass(frozen=True)
class CandidateScore:
    architecture: str
    resolution_px: int
    composite_score: float
    macro_f1_component: float
    destroyed_recall_component: float
    calibration_component: float
    latency_component: float
    model_size_component: float
    robustness_component: float


@dataclass(frozen=True)
class SelectionResult:
    gate_failures: tuple[GateFailure, ...]
    ranked_candidates: tuple[
        CandidateScore, ...
    ]  # best first; empty if all candidates failed a gate
    recommended: CandidateScore | None


def _passes_gates(result: ArchitectureBenchmarkResult) -> str | None:
    """Returns a failure reason string if `result` fails a hard gate, else None."""
    if result.test_metrics.destroyed_recall is None:
        return (
            "destroyed_recall could not be computed (no destroyed-class examples in the test set)"
        )
    if result.test_metrics.destroyed_recall < MIN_ACCEPTABLE_DESTROYED_RECALL:
        return (
            f"destroyed_recall {result.test_metrics.destroyed_recall:.3f} below the "
            f"minimum acceptable {MIN_ACCEPTABLE_DESTROYED_RECALL}"
        )
    if result.latency.p95_ms > MAX_ACCEPTABLE_P95_LATENCY_MS:
        return (
            f"CPU p95 latency {result.latency.p95_ms:.1f}ms exceeds the maximum acceptable "
            f"{MAX_ACCEPTABLE_P95_LATENCY_MS}ms"
        )
    return None


def _normalize(value: float, minimum: float, maximum: float) -> float:
    """Min-max normalizes to [0, 1] — returns 0.5 (neutral) when every
    candidate has the same value, avoiding a division by zero that would
    otherwise arbitrarily favor whichever candidate happens to be compared
    first."""
    if maximum - minimum < 1e-9:
        return 0.5
    return (value - minimum) / (maximum - minimum)


def apply_selection_rule(report: BenchmarkReport) -> SelectionResult:
    gate_failures: list[GateFailure] = []
    passing: list[ArchitectureBenchmarkResult] = []

    for result in report.architecture_results:
        failure_reason = _passes_gates(result)
        if failure_reason is not None:
            gate_failures.append(
                GateFailure(
                    architecture=result.architecture,
                    resolution_px=result.resolution_px,
                    reason=failure_reason,
                )
            )
        else:
            passing.append(result)

    if not passing:
        return SelectionResult(
            gate_failures=tuple(gate_failures), ranked_candidates=(), recommended=None
        )

    latencies = [r.latency.p95_ms for r in passing]
    sizes = [r.checkpoint_size_bytes for r in passing]
    min_latency, max_latency = min(latencies), max(latencies)
    min_size, max_size = min(sizes), max(sizes)

    scored: list[CandidateScore] = []
    for result in passing:
        macro_f1_component = result.test_metrics.macro_f1
        destroyed_recall_component = result.test_metrics.destroyed_recall or 0.0
        calibration_component = 1.0 - min(result.calibration_error, 1.0)
        # Latency/size: lower is better, so normalize then invert.
        latency_component = 1.0 - _normalize(result.latency.p95_ms, min_latency, max_latency)
        model_size_component = 1.0 - _normalize(
            float(result.checkpoint_size_bytes), float(min_size), float(max_size)
        )
        mean_robustness_drop = (
            sum(r.macro_f1_drop for r in result.robustness) / len(result.robustness)
            if result.robustness
            else 0.0
        )
        robustness_component = 1.0 - min(max(mean_robustness_drop, 0.0), 1.0)

        composite = (
            WEIGHT_MACRO_F1 * macro_f1_component
            + WEIGHT_DESTROYED_RECALL * destroyed_recall_component
            + WEIGHT_CALIBRATION * calibration_component
            + WEIGHT_LATENCY * latency_component
            + WEIGHT_MODEL_SIZE * model_size_component
            + WEIGHT_ROBUSTNESS * robustness_component
        )

        scored.append(
            CandidateScore(
                architecture=result.architecture,
                resolution_px=result.resolution_px,
                composite_score=composite,
                macro_f1_component=macro_f1_component,
                destroyed_recall_component=destroyed_recall_component,
                calibration_component=calibration_component,
                latency_component=latency_component,
                model_size_component=model_size_component,
                robustness_component=robustness_component,
            )
        )

    scored.sort(key=lambda c: c.composite_score, reverse=True)

    return SelectionResult(
        gate_failures=tuple(gate_failures),
        ranked_candidates=tuple(scored),
        recommended=scored[0],
    )
