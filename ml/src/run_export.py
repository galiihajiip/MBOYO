"""Model export entry point (`pnpm ml:export`).

Exports a trained checkpoint to ONNX + TorchScript, writes a metadata JSON
(field names mirroring supabase's model_registry_entries/model_evaluations
columns — see export.py's module docstring), a preprocessing spec, SHA-256
checksums, and a runtime latency benchmark of the exported ONNX artifact
via ONNX Runtime.

Also generates a handful of Grad-CAM overlays from real test-split images
(never fabricated), each saved alongside GRAD_CAM_DISCLAIMER, for Verifier
tooling to eventually surface (via the model_explanations table — no
consumer UI exists yet, per BLOCK 20's research).

Requires an already-run evaluation (ml:evaluate) so the exported metadata
carries real macro_f1/destroyed_recall/calibration_error/is_advisory_only
values, never guessed ones — this script re-runs the untouched-test-set
evaluation itself (reusing evaluate.py) rather than trying to parse
numbers back out of a previously-written Markdown report.

Modes mirror run_benchmark.py/run_evaluate.py's precedent:
  --smoke-test   Trains a tiny model on synthetic data, evaluates it, and
                 exports it — proving the full export pipeline works
                 end to end. Every artifact is written under a temporary
                 directory and the metadata's `version` is prefixed
                 `smoke-test-` so it can never be mistaken for a real
                 release candidate.
  --checkpoint   Exports a real checkpoint. If none exists yet, exits 0
                 with a clear "no trained model exists yet" message.
"""

from __future__ import annotations

import argparse
import sys
import tempfile
from datetime import UTC, datetime
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
from training.experiment_log import ExperimentLogger
from training.export import (
    ExportManifest,
    PreprocessingSpec,
    benchmark_onnx_runtime_latency,
    export_onnx,
    export_torchscript,
    write_export_manifest,
)
from training.gradcam import GRAD_CAM_DISCLAIMER, compute_grad_cam, render_overlay
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
    return [1.0] * count


def _generate_gradcam_samples(
    model: torch.nn.Module,
    test_rows: list,  # type: ignore[type-arg]
    raw_dir: Path,
    classes: tuple[str, ...],
    resolution_px: int,
    normalization: tuple[tuple[float, float, float], tuple[float, float, float]],
    output_dir: Path,
    max_samples: int = 3,
) -> list[Path]:
    from PIL import Image

    from training.dataset import build_transform, effective_label

    transform = build_transform(resolution_px, *normalization, augment=False)
    output_dir.mkdir(parents=True, exist_ok=True)
    written_paths: list[Path] = []

    for row in test_rows[:max_samples]:
        image_path = raw_dir / row.source_id / row.relative_path
        with Image.open(image_path) as img:
            original = img.convert("RGB").resize((resolution_px, resolution_px))
        tensor = transform(original).unsqueeze(0)
        cam_result = compute_grad_cam(model, tensor)
        overlay = render_overlay(original, cam_result.class_activation_map)

        predicted_class = classes[cam_result.predicted_class_index]
        true_class = effective_label(row)
        output_path = (
            output_dir / f"gradcam_{row.image_id.replace('/', '_')}_"
            f"true-{true_class}_pred-{predicted_class}.png"
        )
        overlay.save(output_path)
        written_paths.append(output_path)

    return written_paths


def _export_and_write(
    model: torch.nn.Module,
    architecture: str,
    resolution_px: int,
    classes: tuple[str, ...],
    dataset_identity: str,
    macro_f1: float,
    destroyed_recall: float | None,
    calibration_error: float,
    is_advisory_only: bool,
    report_path: str,
    models_dir: Path,
    version: str,
) -> Path:
    onnx_path = models_dir / f"{version}.onnx"
    torchscript_path = models_dir / f"{version}.pt"

    onnx_artifact = export_onnx(model, resolution_px, onnx_path)
    torchscript_artifact = export_torchscript(model, resolution_px, torchscript_path)
    runtime_benchmark = benchmark_onnx_runtime_latency(onnx_artifact.path, resolution_px)

    manifest = ExportManifest(
        version=version,
        architecture=architecture,
        artifact_path=str(onnx_artifact.path),
        torchscript_path=str(torchscript_artifact.path),
        trained_at=datetime.now(UTC).isoformat(),
        dataset_identity=dataset_identity,
        macro_f1=macro_f1,
        destroyed_recall=destroyed_recall,
        calibration_error=calibration_error,
        evaluated_at=datetime.now(UTC).isoformat(),
        report_path=report_path,
        classes=classes,
        onnx_checksum=onnx_artifact.sha256_checksum,
        torchscript_checksum=torchscript_artifact.sha256_checksum,
        preprocessing=PreprocessingSpec(
            resolution_px=resolution_px,
            normalization_mean=(0.485, 0.456, 0.406),
            normalization_std=(0.229, 0.224, 0.225),
        ),
        runtime_benchmark=runtime_benchmark,
        is_advisory_only=is_advisory_only,
    )
    return write_export_manifest(manifest, models_dir / f"{version}_metadata.json")


def run_smoke_test(training_config_path: Path, release_criteria_path: Path) -> int:
    try:
        full_training_config = load_training_config(training_config_path)
    except TrainingConfigError as error:
        print(f"ml:export --smoke-test — training config error: {error}", file=sys.stderr)
        return 1

    try:
        release_criteria = load_release_criteria(release_criteria_path)
    except ReleaseCriteriaConfigError as error:
        print(f"ml:export --smoke-test — release criteria config error: {error}", file=sys.stderr)
        return 1

    training_config = derive_smoke_test_training_config(full_training_config)
    set_deterministic_seed(training_config.random_seed)

    classes = ("no_damage", "minor_damage", "major_damage", "destroyed", "unknown")

    with tempfile.TemporaryDirectory(prefix="mboyo-export-smoke-test-") as tmp:
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
                "ml:export --smoke-test — synthetic_image_count_per_class is too small to "
                "populate all three splits."
            )
            return 1

        architecture = training_config.architectures[0]
        resolution_px = training_config.resolutions_px[0]
        build_result = build_model(architecture, num_classes=len(classes))
        set_backbone_trainable(build_result.model, False)

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

        checkpoint_path = tmp_path / "smoke_test_model.pt"
        logger = ExperimentLogger(tmp_path / "smoke_test_export_log.jsonl", "smoke-test-export")

        run_training(
            build_result.model,
            train_loader,
            val_loader,
            classes,
            resolve_device(),
            architecture_name=architecture,
            resolution_px=resolution_px,
            loss_fn=build_loss_function("cross_entropy"),
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
            print(f"ml:export --smoke-test — {error}", file=sys.stderr)
            return 1

        gate_result = evaluate_release_gate(
            evaluation.metrics, evaluation.calibration_error, release_criteria
        )

        models_dir = training_config_path.resolve().parent.parent / "models"
        version = f"smoke-test-{datetime.now(UTC).strftime('%Y%m%dT%H%M%S')}"
        manifest_path_written = _export_and_write(
            build_result.model,
            architecture,
            resolution_px,
            classes,
            "smoke-test-synthetic",
            evaluation.metrics.macro_f1,
            evaluation.metrics.destroyed_recall,
            evaluation.calibration_error,
            gate_result.is_advisory_only,
            report_path="ml/reports/smoke_test_evaluation.md",
            models_dir=models_dir,
            version=version,
        )
        print(f"ml:export --smoke-test — wrote export manifest to {manifest_path_written}")

        gradcam_dir = models_dir / f"{version}_gradcam_samples"
        gradcam_paths = _generate_gradcam_samples(
            build_result.model,
            split_rows.test,
            raw_dir,
            classes,
            resolution_px,
            normalization,
            gradcam_dir,
        )
        print(
            f"ml:export --smoke-test — wrote {len(gradcam_paths)} Grad-CAM sample(s) to "
            f"{gradcam_dir}"
        )
        print(f"ml:export --smoke-test — {GRAD_CAM_DISCLAIMER}")
        print(
            "ml:export --smoke-test — this export used a SYNTHETIC-data-trained model; "
            "it proves the export pipeline works, not a real release candidate."
        )
        return 0


def run_real_export(
    training_config_path: Path,
    dataset_config_path: Path,
    release_criteria_path: Path,
    checkpoint_path: Path | None,
) -> int:
    try:
        training_config = load_training_config(training_config_path)
    except TrainingConfigError as error:
        print(f"ml:export — training config error: {error}", file=sys.stderr)
        return 1

    try:
        dataset_config = load_dataset_config(dataset_config_path)
    except DatasetConfigError as error:
        print(f"ml:export — dataset config error: {error}", file=sys.stderr)
        return 1

    try:
        release_criteria = load_release_criteria(release_criteria_path)
    except ReleaseCriteriaConfigError as error:
        print(f"ml:export — release criteria config error: {error}", file=sys.stderr)
        return 1

    models_dir = Path(training_config.manifest_path).resolve().parent.parent.parent / "models"
    resolved_checkpoint_path = checkpoint_path or (
        models_dir / f"{training_config.architectures[0]}_{training_config.resolutions_px[0]}px.pt"
    )

    if not resolved_checkpoint_path.exists():
        print(
            f"ml:export — no checkpoint found at {resolved_checkpoint_path} "
            "(no trained model exists yet). Nothing to export."
        )
        print("ml:export — run with --smoke-test to exercise the pipeline against synthetic data.")
        return 0

    split_rows = load_split_rows(training_config.manifest_path, dataset_config.classes)
    if not split_rows.val or not split_rows.test:
        print("ml:export — manifest is missing a val or test split. Cannot export.")
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

    version = f"{checkpoint_metadata.architecture}-{datetime.now(UTC).strftime('%Y%m%dT%H%M%S')}"
    manifest_path_written = _export_and_write(
        build_result.model,
        checkpoint_metadata.architecture,
        checkpoint_metadata.resolution_px,
        checkpoint_metadata.classes,
        str(training_config.manifest_path),
        evaluation.metrics.macro_f1,
        evaluation.metrics.destroyed_recall,
        evaluation.calibration_error,
        gate_result.is_advisory_only,
        report_path=str(
            dataset_config.reports_dir / f"{training_config.experiment_name}_evaluation.md"
        ),
        models_dir=models_dir,
        version=version,
    )
    gate_status = "PASSED" if gate_result.passed else "FAILED (advisory-only)"
    print(f"ml:export — wrote export manifest to {manifest_path_written}")
    print(f"ml:export — release gate: {gate_status}")

    gradcam_dir = models_dir / f"{version}_gradcam_samples"
    gradcam_paths = _generate_gradcam_samples(
        build_result.model,
        split_rows.test,
        dataset_config.raw_dir,
        checkpoint_metadata.classes,
        checkpoint_metadata.resolution_px,
        normalization,
        gradcam_dir,
    )
    print(f"ml:export — wrote {len(gradcam_paths)} Grad-CAM sample(s) to {gradcam_dir}")
    print(f"ml:export — {GRAD_CAM_DISCLAIMER}")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Export a trained model to ONNX/TorchScript with metadata."
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
        run_real_export(
            args.training_config, dataset_config_path, args.release_criteria, args.checkpoint
        )
    )


if __name__ == "__main__":
    main()
