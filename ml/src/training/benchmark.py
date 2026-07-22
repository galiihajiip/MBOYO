"""The architecture benchmark harness — this block's central deliverable.

Two-phase methodology (a deliberate, documented scope decision, not an
oversight): running the full architecture x resolution x loss x sampler
grid exhaustively would mean 3 x 2 x 3 x 2 = 36 full training runs, which
is not a proportionate cost for tuning a hyperparameter (loss function,
sampler) that is far cheaper to fix once at a single reference
architecture/resolution than to re-tune per architecture:

  Phase 1 (loss/sampler selection): fix architecture=mobilenet_v3_large
  (the cheapest candidate) at 224px, train once per loss_functions entry
  (and once more with the sampler enabled, if sampler_candidate_enabled),
  and pick whichever produced the best validation macro-F1. This is the
  loss/sampler choice carried into Phase 2 — the benchmark report states
  this methodology explicitly so a reader never mistakes "one reference
  config's winner" for "independently tuned per architecture."

  Phase 2 (architecture x resolution grid): train every
  (architecture, resolution) combination using Phase 1's winning
  loss/sampler choice, then evaluate each on the untouched test split —
  computing macro-F1, per-class metrics, destroyed recall, ECE, abstention
  rate, CPU latency, model size, and robustness-under-degradation. Every
  number is measured from an actual run against actual data (real or
  smoke-test-synthetic, always labeled which); nothing here is a guessed or
  templated figure.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from torch.utils.data import DataLoader, WeightedRandomSampler
from torchvision import transforms

from data_governance.manifest import ManifestRow

from .checkpoints import checkpoint_size_bytes
from .config import TrainingConfig
from .dataset import (
    AugmentationSpec,
    ManifestImageDataset,
    build_transform,
    effective_label,
)
from .experiment_log import ExperimentLogger
from .latency import LatencyMeasurement, measure_cpu_latency
from .losses import build_loss_function, compute_class_weights
from .metrics import (
    ClassificationMetrics,
    compute_abstention_rate,
    compute_classification_metrics,
    compute_expected_calibration_error,
)
from .models import build_model, model_size_bytes, resolve_device, set_backbone_trainable
from .robustness import DegradationSpec, apply_degradation
from .train_loop import run_training


@dataclass(frozen=True)
class LossSelectionResult:
    """Phase 1's output — which loss (and whether the sampler helped)
    performed best at the reference architecture/resolution, and every
    candidate's own validation macro-F1 so the choice is auditable, not
    just asserted."""

    winning_loss_name: str
    winning_sampler_enabled: bool
    candidate_scores: tuple[
        tuple[str, bool, float], ...
    ]  # (loss_name, sampler_enabled, val_macro_f1)


@dataclass(frozen=True)
class RobustnessResult:
    degradation_name: str
    clean_macro_f1: float
    degraded_macro_f1: float
    macro_f1_drop: float


@dataclass(frozen=True)
class ArchitectureBenchmarkResult:
    architecture: str
    resolution_px: int
    test_metrics: ClassificationMetrics
    calibration_error: float
    abstention_rate: float
    latency: LatencyMeasurement
    model_size_bytes_estimate: int
    checkpoint_size_bytes: int
    robustness: tuple[RobustnessResult, ...]
    best_epoch: int
    stopped_early: bool
    epochs_run: int


@dataclass(frozen=True)
class BenchmarkReport:
    generated_at: str
    experiment_name: str
    is_smoke_test: bool
    loss_selection: LossSelectionResult
    architecture_results: tuple[ArchitectureBenchmarkResult, ...]
    dataset_manifest_path: str
    train_count: int
    val_count: int
    test_count: int


def _build_loader(
    rows: list[ManifestRow],
    raw_dir: Path,
    classes: tuple[str, ...],
    resolution_px: int,
    normalization: tuple[tuple[float, float, float], tuple[float, float, float]],
    augment: bool,
    augmentation_spec: AugmentationSpec | None,
    batch_size: int,
    shuffle: bool,
    sampler_weights: list[float] | None = None,
) -> DataLoader[tuple[torch.Tensor, int]]:
    mean, std = normalization
    transform = build_transform(resolution_px, mean, std, augment, augmentation_spec)
    dataset = ManifestImageDataset(rows, raw_dir, classes, transform)

    if sampler_weights is not None:
        sampler = WeightedRandomSampler(
            sampler_weights, num_samples=len(sampler_weights), replacement=True
        )
        return DataLoader(dataset, batch_size=batch_size, sampler=sampler)

    return DataLoader(dataset, batch_size=batch_size, shuffle=shuffle)


def _compute_sampler_weights(rows: list[ManifestRow], classes: tuple[str, ...]) -> list[float]:
    """Inverse-frequency per-sample weight for WeightedRandomSampler — a
    sample from a rarer class is drawn more often. Distinct from
    compute_class_weights (loss-level reweighting): this affects which
    samples the model SEES each epoch, not how much each sample's loss
    counts once seen — the two are independent imbalance-handling
    mechanisms, which is exactly why this block asks them to be benchmarked
    separately rather than assumed redundant."""
    counts: dict[str, int] = {}
    for row in rows:
        label = effective_label(row)
        counts[label] = counts.get(label, 0) + 1

    weights = []
    for row in rows:
        label = effective_label(row)
        weights.append(1.0 / counts[label] if counts.get(label, 0) > 0 else 0.0)
    return weights


def _augmentation_spec_from_config(config: TrainingConfig) -> AugmentationSpec:
    aug = config.augmentation
    return AugmentationSpec(
        horizontal_flip_probability=aug.horizontal_flip_probability,
        rotation_degrees=aug.rotation_degrees,
        color_jitter_brightness=aug.color_jitter.brightness,
        color_jitter_contrast=aug.color_jitter.contrast,
        color_jitter_saturation=aug.color_jitter.saturation,
        gaussian_blur_probability=aug.gaussian_blur_probability,
        gaussian_blur_kernel_size=aug.gaussian_blur_kernel_size,
    )


def _train_one_config(
    config: TrainingConfig,
    classes: tuple[str, ...],
    train_rows: list[ManifestRow],
    val_rows: list[ManifestRow],
    raw_dir: Path,
    architecture: str,
    resolution_px: int,
    loss_name: str,
    sampler_enabled: bool,
    checkpoint_path: Path,
    logger: ExperimentLogger,
) -> tuple[torch.nn.Module, float, int, bool, int]:
    """Runs one full training config, returning (model, best_val_macro_f1,
    best_epoch, stopped_early, epochs_run) — shared by both Phase 1
    (candidate scoring) and Phase 2 (final architecture runs), so the exact
    same training procedure produces both, never two subtly different code
    paths for what is conceptually the same operation."""
    augmentation_spec = _augmentation_spec_from_config(config)
    normalization = (config.normalization.mean, config.normalization.std)

    sampler_weights = _compute_sampler_weights(train_rows, classes) if sampler_enabled else None
    train_loader = _build_loader(
        train_rows,
        raw_dir,
        classes,
        resolution_px,
        normalization,
        augment=True,
        augmentation_spec=augmentation_spec,
        batch_size=config.training.batch_size,
        shuffle=(sampler_weights is None),
        sampler_weights=sampler_weights,
    )
    val_loader = _build_loader(
        val_rows,
        raw_dir,
        classes,
        resolution_px,
        normalization,
        augment=False,
        augmentation_spec=None,
        batch_size=config.training.batch_size,
        shuffle=False,
    )

    train_class_counts: dict[str, int] = {}
    for row in train_rows:
        label = effective_label(row)
        train_class_counts[label] = train_class_counts.get(label, 0) + 1
    class_weights = (
        compute_class_weights(train_class_counts, classes) if loss_name != "cross_entropy" else None
    )
    loss_fn = build_loss_function(loss_name, class_weights, config.focal_loss_gamma)

    build_result = build_model(architecture, num_classes=len(classes))
    model = build_result.model
    set_backbone_trainable(model, False)
    device = resolve_device()

    result = run_training(
        model,
        train_loader,
        val_loader,
        classes,
        device,
        architecture_name=architecture,
        resolution_px=resolution_px,
        loss_fn=loss_fn,
        max_epochs=config.training.max_epochs,
        learning_rate=config.training.learning_rate,
        weight_decay=config.training.weight_decay,
        frozen_backbone_warmup_epochs=config.training.frozen_backbone_warmup_epochs,
        early_stopping_patience_epochs=config.training.early_stopping_patience_epochs,
        early_stopping_min_delta=config.training.early_stopping_min_delta,
        mixed_precision_when_available=config.training.mixed_precision_when_available,
        checkpoint_path=checkpoint_path,
        logger=logger,
    )
    return (
        model,
        result.best_validation_macro_f1,
        result.best_epoch,
        result.stopped_early,
        result.epochs_run,
    )


def select_loss_and_sampler(
    config: TrainingConfig,
    classes: tuple[str, ...],
    train_rows: list[ManifestRow],
    val_rows: list[ManifestRow],
    raw_dir: Path,
    reference_architecture: str,
    reference_resolution_px: int,
    checkpoints_dir: Path,
    logger: ExperimentLogger,
) -> LossSelectionResult:
    """Phase 1 — see module docstring."""
    candidates: list[tuple[str, bool]] = [(loss_name, False) for loss_name in config.loss_functions]
    if config.sampler_candidate_enabled:
        candidates.append((config.loss_functions[0], True))

    scores: list[tuple[str, bool, float]] = []
    for loss_name, sampler_enabled in candidates:
        checkpoint_path = checkpoints_dir / f"phase1_{loss_name}_sampler-{sampler_enabled}.pt"
        _model, best_val_macro_f1, _epoch, _stopped, _epochs_run = _train_one_config(
            config,
            classes,
            train_rows,
            val_rows,
            raw_dir,
            reference_architecture,
            reference_resolution_px,
            loss_name,
            sampler_enabled,
            checkpoint_path,
            logger,
        )
        scores.append((loss_name, sampler_enabled, best_val_macro_f1))

    winning_loss_name, winning_sampler_enabled, _ = max(scores, key=lambda s: s[2])

    return LossSelectionResult(
        winning_loss_name=winning_loss_name,
        winning_sampler_enabled=winning_sampler_enabled,
        candidate_scores=tuple(scores),
    )


def _evaluate_test_set(
    model: torch.nn.Module,
    test_rows: list[ManifestRow],
    raw_dir: Path,
    classes: tuple[str, ...],
    resolution_px: int,
    normalization: tuple[tuple[float, float, float], tuple[float, float, float]],
    batch_size: int,
    ece_bins: int,
    abstention_threshold: float,
    device: torch.device,
) -> tuple[ClassificationMetrics, float, float]:
    """Runs the model over the untouched test set once, returning
    (classification metrics, ECE, abstention rate) — all three computed
    from the SAME forward pass's softmax confidences, never re-run
    separately per metric."""
    mean, std = normalization
    transform = build_transform(resolution_px, mean, std, augment=False)
    dataset = ManifestImageDataset(test_rows, raw_dir, classes, transform)
    loader: DataLoader[tuple[torch.Tensor, int]] = DataLoader(
        dataset, batch_size=batch_size, shuffle=False
    )

    model.eval()
    model.to(device)
    all_true: list[int] = []
    all_pred: list[int] = []
    all_confidence: list[float] = []
    all_correct: list[float] = []

    with torch.no_grad():
        for images, labels in loader:
            images = images.to(device)
            logits = model(images)
            probabilities = torch.softmax(logits, dim=1)
            confidences, predictions = probabilities.max(dim=1)

            all_true.extend(labels.tolist())
            all_pred.extend(predictions.detach().cpu().tolist())
            all_confidence.extend(confidences.detach().cpu().tolist())
            all_correct.extend((predictions.detach().cpu() == labels).float().tolist())

    metrics = compute_classification_metrics(np.array(all_true), np.array(all_pred), classes)
    ece = compute_expected_calibration_error(
        np.array(all_confidence), np.array(all_correct), num_bins=ece_bins
    )
    abstention = compute_abstention_rate(np.array(all_confidence), abstention_threshold)
    return metrics, ece, abstention


class _DegradedManifestImageDataset(ManifestImageDataset):
    """Applies one fixed DegradationSpec to every image before the normal
    transform pipeline — the degradation is bound at construction time
    (never captured from an enclosing loop), so each instance is
    self-contained and independently correct regardless of how many
    degradations a caller iterates over."""

    def __init__(
        self,
        rows: list[ManifestRow],
        raw_dir: Path,
        classes: tuple[str, ...],
        transform: transforms.Compose,
        degradation: DegradationSpec,
    ) -> None:
        super().__init__(rows, raw_dir, classes, transform)
        self._degradation = degradation

    def __getitem__(self, index: int) -> tuple[torch.Tensor, int]:
        row = self._rows[index]
        image_path = self._raw_dir / row.source_id / row.relative_path
        with Image.open(image_path) as img:
            image = img.convert("RGB")
            degraded_image = apply_degradation(image, self._degradation)
            tensor = self._transform(degraded_image)
        label_index = self._class_to_index[effective_label(row)]
        return tensor, label_index


def _evaluate_robustness(
    model: torch.nn.Module,
    test_rows: list[ManifestRow],
    raw_dir: Path,
    classes: tuple[str, ...],
    resolution_px: int,
    normalization: tuple[tuple[float, float, float], tuple[float, float, float]],
    batch_size: int,
    degradations: tuple[DegradationSpec, ...],
    clean_macro_f1: float,
    device: torch.device,
) -> tuple[RobustnessResult, ...]:
    """Re-evaluates the test set with each configured degradation applied at
    load time (a custom transform wrapping build_transform's normal
    pipeline), comparing macro-F1 under degradation to the already-computed
    clean-set macro-F1 — the drop itself is the reported robustness signal,
    per this block's "robustness to poor image quality" selection
    criterion."""
    mean, std = normalization
    results = []

    for degradation in degradations:
        transform = build_transform(resolution_px, mean, std, augment=False)
        dataset = _DegradedManifestImageDataset(test_rows, raw_dir, classes, transform, degradation)
        loader: DataLoader[tuple[torch.Tensor, int]] = DataLoader(
            dataset, batch_size=batch_size, shuffle=False
        )

        model.eval()
        model.to(device)
        all_true: list[int] = []
        all_pred: list[int] = []
        with torch.no_grad():
            for images, labels in loader:
                images = images.to(device)
                logits = model(images)
                predictions = logits.argmax(dim=1)
                all_true.extend(labels.tolist())
                all_pred.extend(predictions.detach().cpu().tolist())

        degraded_metrics = compute_classification_metrics(
            np.array(all_true), np.array(all_pred), classes
        )
        results.append(
            RobustnessResult(
                degradation_name=degradation.name,
                clean_macro_f1=clean_macro_f1,
                degraded_macro_f1=degraded_metrics.macro_f1,
                macro_f1_drop=clean_macro_f1 - degraded_metrics.macro_f1,
            )
        )

    return tuple(results)


def run_benchmark(
    config: TrainingConfig,
    classes: tuple[str, ...],
    train_rows: list[ManifestRow],
    val_rows: list[ManifestRow],
    test_rows: list[ManifestRow],
    raw_dir: Path,
    checkpoints_dir: Path,
    logger: ExperimentLogger,
    is_smoke_test: bool,
    manifest_path_override: Path | None = None,
) -> BenchmarkReport:
    """The full two-phase benchmark — see module docstring for the
    methodology. Every architecture in config.architectures is trained at
    every resolution in config.resolutions_px, using Phase 1's winning
    loss/sampler choice, then evaluated on the untouched test split.

    manifest_path_override lets a caller (e.g. the smoke-test entry point,
    which generates a temporary synthetic manifest rather than using
    config.manifest_path's real dataset location) record the manifest that
    ACTUALLY produced these rows in the report, rather than the training
    config's own configured-but-unused path."""
    reference_architecture = config.architectures[0]
    reference_resolution = config.resolutions_px[0]

    loss_selection = select_loss_and_sampler(
        config,
        classes,
        train_rows,
        val_rows,
        raw_dir,
        reference_architecture,
        reference_resolution,
        checkpoints_dir,
        logger,
    )

    device = resolve_device()
    normalization = (config.normalization.mean, config.normalization.std)
    degradation_specs = tuple(
        DegradationSpec(name=d.name, params=d.params) for d in config.robustness.degradations
    )

    architecture_results = []
    for architecture in config.architectures:
        for resolution_px in config.resolutions_px:
            checkpoint_path = checkpoints_dir / f"{architecture}_{resolution_px}px.pt"
            model, _best_val_f1, best_epoch, stopped_early, epochs_run = _train_one_config(
                config,
                classes,
                train_rows,
                val_rows,
                raw_dir,
                architecture,
                resolution_px,
                loss_selection.winning_loss_name,
                loss_selection.winning_sampler_enabled,
                checkpoint_path,
                logger,
            )

            test_metrics, ece, abstention = _evaluate_test_set(
                model,
                test_rows,
                raw_dir,
                classes,
                resolution_px,
                normalization,
                config.training.batch_size,
                config.calibration.ece_bins,
                config.abstention_confidence_threshold,
                device,
            )

            robustness_results = _evaluate_robustness(
                model,
                test_rows,
                raw_dir,
                classes,
                resolution_px,
                normalization,
                config.training.batch_size,
                degradation_specs,
                test_metrics.macro_f1,
                device,
            )

            latency = measure_cpu_latency(model, resolution_px)

            architecture_results.append(
                ArchitectureBenchmarkResult(
                    architecture=architecture,
                    resolution_px=resolution_px,
                    test_metrics=test_metrics,
                    calibration_error=ece,
                    abstention_rate=abstention,
                    latency=latency,
                    model_size_bytes_estimate=model_size_bytes(model),
                    checkpoint_size_bytes=checkpoint_size_bytes(checkpoint_path),
                    robustness=robustness_results,
                    best_epoch=best_epoch,
                    stopped_early=stopped_early,
                    epochs_run=epochs_run,
                )
            )

    return BenchmarkReport(
        generated_at=datetime.now(UTC).isoformat(),
        experiment_name=config.experiment_name,
        is_smoke_test=is_smoke_test,
        loss_selection=loss_selection,
        architecture_results=tuple(architecture_results),
        dataset_manifest_path=str(manifest_path_override or config.manifest_path),
        train_count=len(train_rows),
        val_count=len(val_rows),
        test_count=len(test_rows),
    )
