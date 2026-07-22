"""Untouched-test-set evaluation entry point (`pnpm ml:evaluate`).

Evaluates ONE already-trained checkpoint (produced by BLOCK 19's
run_benchmark.py or a future training run) against the untouched test
split only: confusion matrix, macro/micro/weighted F1, destroyed recall,
per-class metrics, PR curves, calibration curve, ECE, abstention rate,
robustness under image-quality degradation, plus the release-gate
promote/advisory-only decision.

Two modes, mirroring run_benchmark.py's precedent exactly:
  --smoke-test   Trains a tiny model on synthetic data (never real images)
                 first, then evaluates it end to end — proves the full
                 evaluation pipeline works, never cited as a real result.
  --checkpoint   Evaluates a real checkpoint against the real dataset
                 manifest. If no checkpoint path is given and none exists
                 yet under ml/models/, exits 0 with a clear "no trained
                 model exists yet" message — never fabricates a report.
"""

from __future__ import annotations

import argparse
import sys
import tempfile
from pathlib import Path

import torch
from torch.utils.data import DataLoader

from data_governance.config import DEFAULT_CONFIG_PATH, load_dataset_config
from data_governance.config import ConfigError as DatasetConfigError
from data_governance.manifest import write_manifest
from training.checkpoints import load_checkpoint_metadata
from training.config import (
    DEFAULT_TRAINING_CONFIG_PATH,
    TrainingConfigError,
    derive_smoke_test_training_config,
    load_training_config,
)
from training.dataset import EmptySplitError, ManifestImageDataset, build_transform, load_split_rows
from training.evaluate import EvaluationConfig, run_untouched_test_evaluation
from training.evaluation_report import write_evaluation_report
from training.experiment_log import ExperimentLogger
from training.losses import build_loss_function
from training.models import build_model, resolve_device, set_backbone_trainable
from training.release_config import (
    DEFAULT_RELEASE_CRITERIA_PATH,
    ReleaseCriteriaConfigError,
    load_release_criteria,
)
from training.release_gate import evaluate_release_gate
from training.seeding import set_deterministic_seed
from training.smoke_test_data import generate_smoke_test_dataset
from training.train_loop import run_training


def _default_quality_scores(count: int) -> list[float]:
    """No real per-report quality score pipeline is wired into this CLI yet
    (data_governance's quality signal is per-manifest-row at prepare time,
    BLOCK 18) — using a neutral 1.0 placeholder, explicitly labeled here
    rather than silently treated as a real measured quality score, so a
    future block wiring in the real signal has an obvious seam to replace."""
    return [1.0] * count


def run_real_evaluation(
    training_config_path: Path,
    dataset_config_path: Path,
    release_criteria_path: Path,
    checkpoint_path: Path | None,
) -> int:
    try:
        training_config = load_training_config(training_config_path)
    except TrainingConfigError as error:
        print(f"ml:evaluate — training config error: {error}", file=sys.stderr)
        return 1

    try:
        dataset_config = load_dataset_config(dataset_config_path)
    except DatasetConfigError as error:
        print(f"ml:evaluate — dataset config error: {error}", file=sys.stderr)
        return 1

    try:
        release_criteria = load_release_criteria(release_criteria_path)
    except ReleaseCriteriaConfigError as error:
        print(f"ml:evaluate — release criteria config error: {error}", file=sys.stderr)
        return 1

    models_dir = Path(training_config.manifest_path).resolve().parent.parent.parent / "models"
    resolved_checkpoint_path = checkpoint_path or (
        models_dir / f"{training_config.architectures[0]}_{training_config.resolutions_px[0]}px.pt"
    )

    if not resolved_checkpoint_path.exists():
        print(
            f"ml:evaluate — no checkpoint found at {resolved_checkpoint_path} "
            "(no trained model exists yet). Nothing to evaluate."
        )
        print(
            "ml:evaluate — run with --smoke-test to exercise the pipeline against synthetic data."
        )
        return 0

    split_rows = load_split_rows(training_config.manifest_path, dataset_config.classes)
    if not split_rows.val or not split_rows.test:
        print(
            "ml:evaluate — manifest is missing a val or test split "
            f"(val={len(split_rows.val)}, test={len(split_rows.test)}). Cannot evaluate."
        )
        return 0

    checkpoint_metadata = load_checkpoint_metadata(resolved_checkpoint_path)
    build_result = build_model(
        checkpoint_metadata.architecture, num_classes=len(checkpoint_metadata.classes)
    )

    payload = torch.load(resolved_checkpoint_path, map_location="cpu", weights_only=False)
    build_result.model.load_state_dict(payload["model_state_dict"])

    normalization = (training_config.normalization.mean, training_config.normalization.std)
    eval_config = EvaluationConfig(
        ece_bins=training_config.calibration.ece_bins,
        default_abstention_confidence_threshold=training_config.abstention_confidence_threshold,
        per_class_threshold_target_precision=0.7,
        max_entropy_nats=1.5,
        quality_score_min=0.3,
        resolution_px=checkpoint_metadata.resolution_px,
        batch_size=training_config.training.batch_size,
    )

    evaluation = run_untouched_test_evaluation(
        build_result.model,
        checkpoint_metadata.classes,
        split_rows.val,
        split_rows.test,
        _default_quality_scores(len(split_rows.test)),
        dataset_config.raw_dir,
        normalization,
        dataset_identity=str(training_config.manifest_path),
        config=eval_config,
    )
    gate_result = evaluate_release_gate(
        evaluation.metrics, evaluation.calibration_error, release_criteria
    )

    report_path = write_evaluation_report(
        evaluation,
        gate_result,
        dataset_config.reports_dir,
        f"{training_config.experiment_name}_evaluation.md",
    )
    gate_status = "PASSED" if gate_result.passed else "FAILED (advisory-only)"
    print(f"ml:evaluate — wrote report to {report_path}")
    print(f"ml:evaluate — release gate: {gate_status}")
    return 0


def run_smoke_test(training_config_path: Path, release_criteria_path: Path) -> int:
    try:
        full_training_config = load_training_config(training_config_path)
    except TrainingConfigError as error:
        print(f"ml:evaluate --smoke-test — training config error: {error}", file=sys.stderr)
        return 1

    try:
        release_criteria = load_release_criteria(release_criteria_path)
    except ReleaseCriteriaConfigError as error:
        print(f"ml:evaluate --smoke-test — release criteria config error: {error}", file=sys.stderr)
        return 1

    training_config = derive_smoke_test_training_config(full_training_config)
    set_deterministic_seed(training_config.random_seed)

    classes = ("no_damage", "minor_damage", "major_damage", "destroyed", "unknown")

    with tempfile.TemporaryDirectory(prefix="mboyo-eval-smoke-test-") as tmp:
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
                "ml:evaluate --smoke-test — synthetic_image_count_per_class is too small to "
                "populate all three splits; increase ml/configs/training.yaml's "
                "smoke_test.synthetic_image_count_per_class."
            )
            return 1

        # Train a tiny real model on synthetic data first — evaluate.py has
        # nothing to evaluate without an actual trained checkpoint.
        architecture = training_config.architectures[0]
        resolution_px = training_config.resolutions_px[0]
        build_result = build_model(architecture, num_classes=len(classes))
        set_backbone_trainable(build_result.model, False)
        device = resolve_device()

        normalization = (training_config.normalization.mean, training_config.normalization.std)
        transform = build_transform(resolution_px, *normalization, augment=False)
        train_loader: DataLoader[tuple[torch.Tensor, int]] = DataLoader(
            ManifestImageDataset(split_rows.train, raw_dir, classes, transform),
            batch_size=training_config.training.batch_size,
            shuffle=True,
        )
        val_loader: DataLoader[tuple[torch.Tensor, int]] = DataLoader(
            ManifestImageDataset(split_rows.val, raw_dir, classes, transform),
            batch_size=training_config.training.batch_size,
            shuffle=False,
        )

        loss_fn = build_loss_function("cross_entropy")
        checkpoint_path = tmp_path / "smoke_test_model.pt"
        logger = ExperimentLogger(tmp_path / "smoke_test_eval_log.jsonl", "smoke-test-eval")

        run_training(
            build_result.model,
            train_loader,
            val_loader,
            classes,
            device,
            architecture_name=architecture,
            resolution_px=resolution_px,
            loss_fn=loss_fn,
            max_epochs=training_config.training.max_epochs,
            learning_rate=training_config.training.learning_rate,
            weight_decay=training_config.training.weight_decay,
            frozen_backbone_warmup_epochs=training_config.training.frozen_backbone_warmup_epochs,
            early_stopping_patience_epochs=training_config.training.early_stopping_patience_epochs,
            early_stopping_min_delta=training_config.training.early_stopping_min_delta,
            mixed_precision_when_available=training_config.training.mixed_precision_when_available,
            checkpoint_path=checkpoint_path,
            logger=logger,
        )

        try:
            eval_config = EvaluationConfig(
                ece_bins=training_config.calibration.ece_bins,
                default_abstention_confidence_threshold=training_config.abstention_confidence_threshold,
                per_class_threshold_target_precision=0.7,
                max_entropy_nats=1.5,
                quality_score_min=0.3,
                resolution_px=resolution_px,
                batch_size=training_config.training.batch_size,
            )
            evaluation = run_untouched_test_evaluation(
                build_result.model,
                classes,
                split_rows.val,
                split_rows.test,
                _default_quality_scores(len(split_rows.test)),
                raw_dir,
                normalization,
                dataset_identity="smoke-test-synthetic",
                config=eval_config,
            )
        except EmptySplitError as error:
            print(f"ml:evaluate --smoke-test — {error}", file=sys.stderr)
            return 1

        gate_result = evaluate_release_gate(
            evaluation.metrics, evaluation.calibration_error, release_criteria
        )

        reports_dir = training_config_path.resolve().parent.parent / "reports"
        report_path = write_evaluation_report(
            evaluation, gate_result, reports_dir, "smoke_test_evaluation.md"
        )
        print(f"ml:evaluate --smoke-test — wrote report to {report_path}")
        print(
            "ml:evaluate --smoke-test — this report used SYNTHETIC data only; "
            "it proves the pipeline works, not real model performance."
        )
        return 0


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Evaluate a trained model on the untouched test split."
    )
    parser.add_argument("--training-config", type=Path, default=DEFAULT_TRAINING_CONFIG_PATH)
    parser.add_argument("--dataset-config", type=Path, default=None)
    parser.add_argument("--release-criteria", type=Path, default=DEFAULT_RELEASE_CRITERIA_PATH)
    parser.add_argument("--checkpoint", type=Path, default=None)
    parser.add_argument("--smoke-test", action="store_true")
    args = parser.parse_args()

    if args.smoke_test:
        sys.exit(run_smoke_test(args.training_config, args.release_criteria))

    dataset_config_path = (
        args.dataset_config if args.dataset_config is not None else DEFAULT_CONFIG_PATH
    )
    sys.exit(
        run_real_evaluation(
            args.training_config, dataset_config_path, args.release_criteria, args.checkpoint
        )
    )


if __name__ == "__main__":
    main()
