"""Model architecture benchmark entry point (`pnpm ml:benchmark`).

Compares MobileNetV3-Large, EfficientNetV2-S, and ConvNeXt-Tiny (per
ml/configs/training.yaml's `architectures` list) via the two-phase
methodology documented in training/benchmark.py and
ml/BENCHMARK_METHODOLOGY.md, producing a checked-in report under
ml/reports/ and a documented composite selection recommendation.

Two modes:
  --smoke-test   Runs against a tiny SYNTHETIC dataset (never real images),
                 generated fresh each run — proves the full pipeline works
                 end to end. The generated report is explicitly labeled
                 is_smoke_test: true and must never be cited as a real
                 benchmark result.
  (default)      Runs against ml/configs/dataset.yaml's real split.csv
                 manifest. If that manifest has zero usable rows (the
                 honest current state — no real training data exists yet,
                 per BLOCK 18), this exits 0 with a clear "no data, cannot
                 benchmark" message — never fabricates a report, per
                 AGENTS.md's ML honesty rules and this block's own "no fake
                 metrics" requirement.
"""

from __future__ import annotations

import argparse
import sys
import tempfile
from pathlib import Path

from data_governance.config import DEFAULT_CONFIG_PATH, load_dataset_config
from data_governance.config import ConfigError as DatasetConfigError
from data_governance.manifest import write_manifest
from training.benchmark import run_benchmark
from training.config import (
    DEFAULT_TRAINING_CONFIG_PATH,
    TrainingConfigError,
    derive_smoke_test_training_config,
    load_training_config,
)
from training.dataset import EmptySplitError, load_split_rows
from training.experiment_log import ExperimentLogger
from training.report import write_benchmark_report
from training.seeding import set_deterministic_seed
from training.selection_rule import apply_selection_rule
from training.smoke_test_data import generate_smoke_test_dataset


def run_real_benchmark(training_config_path: Path, dataset_config_path: Path) -> int:
    try:
        training_config = load_training_config(training_config_path)
    except TrainingConfigError as error:
        print(f"ml:benchmark — training config error: {error}", file=sys.stderr)
        return 1

    try:
        dataset_config = load_dataset_config(dataset_config_path)
    except DatasetConfigError as error:
        print(f"ml:benchmark — dataset config error: {error}", file=sys.stderr)
        return 1

    set_deterministic_seed(training_config.random_seed)

    split_rows = load_split_rows(training_config.manifest_path, dataset_config.classes)
    total_rows = len(split_rows.train) + len(split_rows.val) + len(split_rows.test)

    if total_rows == 0:
        print(
            f"ml:benchmark — {training_config.manifest_path} has no usable rows "
            "(no real training data exists yet). Nothing to benchmark."
        )
        print(
            "ml:benchmark — run with --smoke-test to exercise the pipeline against synthetic data."
        )
        return 0

    if not split_rows.train or not split_rows.val or not split_rows.test:
        print(
            "ml:benchmark — manifest has data but at least one split "
            f"(train={len(split_rows.train)}, val={len(split_rows.val)}, "
            f"test={len(split_rows.test)}) is empty. Cannot benchmark without all three "
            "splits populated."
        )
        return 0

    checkpoints_dir = Path(training_config.manifest_path).resolve().parent.parent.parent / "models"
    logs_dir = checkpoints_dir.parent / "reports"
    logger = ExperimentLogger(
        logs_dir / f"{training_config.experiment_name}.jsonl", training_config.experiment_name
    )

    report = run_benchmark(
        training_config,
        dataset_config.classes,
        split_rows.train,
        split_rows.val,
        split_rows.test,
        dataset_config.raw_dir,
        checkpoints_dir,
        logger,
        is_smoke_test=False,
    )
    selection = apply_selection_rule(report)
    report_path = write_benchmark_report(
        report,
        selection,
        dataset_config.reports_dir,
        f"{training_config.experiment_name}_benchmark.md",
    )
    print(f"ml:benchmark — wrote report to {report_path}")
    return 0


def run_smoke_test(training_config_path: Path) -> int:
    try:
        full_training_config = load_training_config(training_config_path)
    except TrainingConfigError as error:
        print(f"ml:benchmark --smoke-test — training config error: {error}", file=sys.stderr)
        return 1

    # Scoped to ONE architecture/resolution/loss and a handful of epochs —
    # see derive_smoke_test_training_config's own doc comment for why this
    # is not just "the full grid on less data."
    training_config = derive_smoke_test_training_config(full_training_config)

    set_deterministic_seed(training_config.random_seed)

    classes = ("no_damage", "minor_damage", "major_damage", "destroyed", "unknown")

    with tempfile.TemporaryDirectory(prefix="mboyo-smoke-test-") as tmp:
        tmp_path = Path(tmp)
        raw_dir = tmp_path / "raw"
        rows = generate_smoke_test_dataset(
            raw_dir,
            classes,
            training_config.smoke_test.synthetic_image_count_per_class,
            training_config.smoke_test.image_size_px,
        )
        manifest_path = tmp_path / "smoke_test_split.csv"
        write_manifest(rows, manifest_path)

        split_rows = load_split_rows(manifest_path, classes)
        if not split_rows.train or not split_rows.val or not split_rows.test:
            print(
                "ml:benchmark --smoke-test — synthetic_image_count_per_class is too small to "
                "populate all three splits; increase ml/configs/training.yaml's "
                "smoke_test.synthetic_image_count_per_class."
            )
            return 1

        checkpoints_dir = tmp_path / "checkpoints"
        checkpoints_dir.mkdir()
        logger = ExperimentLogger(tmp_path / "smoke_test_log.jsonl", "smoke-test")

        try:
            report = run_benchmark(
                training_config,
                classes,
                split_rows.train,
                split_rows.val,
                split_rows.test,
                raw_dir,
                checkpoints_dir,
                logger,
                is_smoke_test=True,
                manifest_path_override=manifest_path,
            )
        except EmptySplitError as error:
            print(f"ml:benchmark --smoke-test — {error}", file=sys.stderr)
            return 1

        selection = apply_selection_rule(report)
        default_dataset_config_root = training_config_path.resolve().parent
        reports_dir = default_dataset_config_root.parent / "reports"
        report_path = write_benchmark_report(
            report, selection, reports_dir, "smoke_test_benchmark.md"
        )
        print(f"ml:benchmark --smoke-test — wrote report to {report_path}")
        print(
            "ml:benchmark --smoke-test — this report used SYNTHETIC data only; "
            "it proves the pipeline works, not real model performance."
        )
        return 0


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Benchmark MobileNetV3-Large/EfficientNetV2-S/ConvNeXt-Tiny."
    )
    parser.add_argument("--training-config", type=Path, default=DEFAULT_TRAINING_CONFIG_PATH)
    parser.add_argument(
        "--dataset-config",
        type=Path,
        default=None,
        help="Defaults to ml/configs/dataset.yaml (data_governance.config.DEFAULT_CONFIG_PATH).",
    )
    parser.add_argument(
        "--smoke-test",
        action="store_true",
        help="Run against a tiny synthetic dataset instead of real training data.",
    )
    args = parser.parse_args()

    if args.smoke_test:
        sys.exit(run_smoke_test(args.training_config))

    dataset_config_path = (
        args.dataset_config if args.dataset_config is not None else DEFAULT_CONFIG_PATH
    )
    sys.exit(run_real_benchmark(args.training_config, dataset_config_path))


if __name__ == "__main__":
    main()
