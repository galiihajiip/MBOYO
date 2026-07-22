"""The training loop: transfer learning with a frozen-backbone warmup phase,
mixed precision when a CUDA device is available (a no-op on CPU-only runs,
per this block's "mixed precision when available" requirement being
conditional), early stopping on validation macro-F1, per-epoch checkpointing
of the best-so-far model, and full experiment logging.

Runs identically whether called with a real dataset (via
dataset.load_split_rows against BLOCK 18's split.csv) or the CPU smoke-test
synthetic dataset (see smoke_test.py) — the loop itself has no branch for
"is this smoke test," only its caller decides which dataset to hand it,
which is what makes the smoke test a genuine end-to-end exercise of this
exact code path rather than a separate, divergent code path that could
silently drift from what real training actually does.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch
from torch import nn
from torch.amp import GradScaler, autocast  # type: ignore[attr-defined]
from torch.utils.data import DataLoader

from .checkpoints import CheckpointMetadata, save_checkpoint
from .early_stopping import EarlyStopping
from .experiment_log import ExperimentLogger
from .metrics import compute_classification_metrics
from .models import set_backbone_trainable


@dataclass(frozen=True)
class TrainLoopResult:
    best_epoch: int
    best_validation_macro_f1: float
    stopped_early: bool
    epochs_run: int
    checkpoint_path: Path


@dataclass(frozen=True)
class EpochRunResult:
    mean_loss: float
    accuracy: float
    y_true: list[int]
    y_pred: list[int]


def _run_one_epoch(
    model: nn.Module,
    loader: DataLoader[tuple[torch.Tensor, int]],
    device: torch.device,
    optimizer: torch.optim.Optimizer | None,
    loss_fn: nn.Module,
    use_amp: bool,
    scaler: GradScaler | None,
) -> EpochRunResult:
    """One pass over `loader`, returning loss/accuracy AND every prediction
    made — optimizer=None means evaluation mode (no gradient step), used for
    both validation and test evaluation, so there is exactly one code path
    for "run the model over a dataset and collect predictions," never a
    separate hand-duplicated eval loop that could compute metrics
    differently from training's own view of the same forward pass, and
    never a second forward pass over the same batch just to re-derive
    predictions already computed once here."""
    is_train = optimizer is not None
    model.train(is_train)

    total_loss = 0.0
    total_samples = 0
    all_true: list[int] = []
    all_pred: list[int] = []

    for images, labels in loader:
        images = images.to(device)
        labels = labels.to(device)

        if optimizer is not None:
            optimizer.zero_grad()

        with torch.set_grad_enabled(is_train):
            if use_amp and scaler is not None:
                with autocast(device_type=device.type):
                    logits = model(images)
                    loss = loss_fn(logits, labels)
                if optimizer is not None:
                    scaler.scale(loss).backward()
                    scaler.step(optimizer)
                    scaler.update()
            else:
                logits = model(images)
                loss = loss_fn(logits, labels)
                if optimizer is not None:
                    loss.backward()
                    optimizer.step()

        batch_size = images.size(0)
        total_loss += loss.item() * batch_size
        total_samples += batch_size

        predictions = logits.argmax(dim=1)
        all_true.extend(labels.detach().cpu().tolist())
        all_pred.extend(predictions.detach().cpu().tolist())

    mean_loss = total_loss / max(total_samples, 1)
    accuracy = float(np.mean(np.array(all_true) == np.array(all_pred))) if all_true else 0.0
    return EpochRunResult(mean_loss=mean_loss, accuracy=accuracy, y_true=all_true, y_pred=all_pred)


def run_training(
    model: nn.Module,
    train_loader: DataLoader[tuple[torch.Tensor, int]],
    val_loader: DataLoader[tuple[torch.Tensor, int]],
    classes: tuple[str, ...],
    device: torch.device,
    architecture_name: str,
    resolution_px: int,
    loss_fn: nn.Module,
    max_epochs: int,
    learning_rate: float,
    weight_decay: float,
    frozen_backbone_warmup_epochs: int,
    early_stopping_patience_epochs: int,
    early_stopping_min_delta: float,
    mixed_precision_when_available: bool,
    checkpoint_path: Path,
    logger: ExperimentLogger,
) -> TrainLoopResult:
    model.to(device)
    use_amp = mixed_precision_when_available and device.type == "cuda"
    scaler = GradScaler(device.type) if use_amp else None

    optimizer = torch.optim.AdamW(
        (p for p in model.parameters() if p.requires_grad),
        lr=learning_rate,
        weight_decay=weight_decay,
    )

    early_stopping = EarlyStopping(
        patience_epochs=early_stopping_patience_epochs, min_delta=early_stopping_min_delta
    )
    logger.log_event(
        "run_started",
        {"architecture": architecture_name, "resolution_px": resolution_px, "device": device.type},
    )

    best_validation_macro_f1 = float("-inf")
    best_epoch = -1
    stopped_early = False
    epochs_run = 0

    for epoch in range(max_epochs):
        epochs_run = epoch + 1

        # Two-phase transfer learning: backbone frozen for the first
        # frozen_backbone_warmup_epochs (only the fresh classification head
        # trains), then unfrozen for full fine-tuning — the optimizer's
        # parameter list was already fixed to requires_grad=True params at
        # construction time, so unfreezing here means those newly-trainable
        # backbone params won't receive gradient updates until a new
        # optimizer is constructed; this is deliberate — re-fetching an
        # optimizer with the newly-unfrozen params at the warmup boundary.
        if epoch == frozen_backbone_warmup_epochs:
            set_backbone_trainable(model, True)
            optimizer = torch.optim.AdamW(
                model.parameters(), lr=learning_rate, weight_decay=weight_decay
            )

        train_result = _run_one_epoch(
            model, train_loader, device, optimizer, loss_fn, use_amp, scaler
        )
        logger.log_epoch(epoch, "train", train_result.mean_loss, accuracy=train_result.accuracy)

        val_result = _run_one_epoch(model, val_loader, device, None, loss_fn, use_amp, scaler)
        val_metrics = compute_classification_metrics(
            np.array(val_result.y_true), np.array(val_result.y_pred), classes
        )
        val_loss = val_result.mean_loss
        logger.log_epoch(
            epoch, "val", val_loss, macro_f1=val_metrics.macro_f1, accuracy=val_metrics.accuracy
        )

        if val_metrics.macro_f1 > best_validation_macro_f1:
            best_validation_macro_f1 = val_metrics.macro_f1
            best_epoch = epoch
            save_checkpoint(
                model,
                CheckpointMetadata(
                    architecture=architecture_name,
                    resolution_px=resolution_px,
                    classes=classes,
                    epoch=epoch,
                    validation_macro_f1=val_metrics.macro_f1,
                ),
                checkpoint_path,
            )

        if early_stopping.step(epoch, val_metrics.macro_f1):
            stopped_early = True
            logger.log_event("early_stopped", {"epoch": epoch, "best_epoch": best_epoch})
            break

    logger.log_event(
        "run_finished",
        {
            "epochs_run": epochs_run,
            "best_epoch": best_epoch,
            "best_validation_macro_f1": best_validation_macro_f1,
            "stopped_early": stopped_early,
        },
    )

    return TrainLoopResult(
        best_epoch=best_epoch,
        best_validation_macro_f1=best_validation_macro_f1,
        stopped_early=stopped_early,
        epochs_run=epochs_run,
        checkpoint_path=checkpoint_path,
    )
