"""Early stopping on validation macro-F1 — per this block's explicit
requirement, NOT validation loss. Loss can keep improving on the majority
class while macro-F1 (which weights all classes equally) plateaus or
regresses, and macro-F1 is the metric SUCCESS_METRICS.md's release gate
actually checks.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class EarlyStopping:
    patience_epochs: int
    min_delta: float
    best_score: float = field(default=float("-inf"), init=False)
    epochs_without_improvement: int = field(default=0, init=False)
    best_epoch: int = field(default=-1, init=False)

    def step(self, epoch: int, validation_macro_f1: float) -> bool:
        """Call once per epoch with that epoch's validation macro-F1. Returns
        True if training should stop now (patience exhausted with no
        improvement of at least min_delta over the best score seen so far)."""
        if validation_macro_f1 > self.best_score + self.min_delta:
            self.best_score = validation_macro_f1
            self.best_epoch = epoch
            self.epochs_without_improvement = 0
            return False

        self.epochs_without_improvement += 1
        return self.epochs_without_improvement >= self.patience_epochs
