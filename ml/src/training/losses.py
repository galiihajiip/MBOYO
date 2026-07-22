"""Loss functions benchmarked against each other for class-imbalance handling,
per this block's explicit "class weights/focal loss comparison" requirement —
plain cross-entropy is the baseline every other option must beat to justify
its added complexity, not an assumed-inferior strawman.
"""

from __future__ import annotations

import torch
from torch import nn


def compute_class_weights(
    class_counts: dict[str, int], class_order: tuple[str, ...]
) -> torch.Tensor:
    """Inverse-frequency class weights: weight_i = total / (num_classes *
    count_i), the standard scikit-learn-style "balanced" weighting — a class
    with half the average frequency gets 2x weight. Classes with zero count
    in the training split get a weight of 0 (they contribute no loss signal,
    which is correct: there's nothing to learn from an absent class, and a
    naive 1/0 weight would produce inf/nan) rather than raising, so a
    manifest that's genuinely missing a class doesn't crash the whole run —
    the missing class is instead visible in the benchmark report's own
    class-distribution section (BLOCK 18's audit.py already computes this).
    """
    total = sum(class_counts.values())
    num_classes = len(class_order)
    weights = []
    for class_name in class_order:
        count = class_counts.get(class_name, 0)
        if count == 0:
            weights.append(0.0)
        else:
            weights.append(total / (num_classes * count))
    return torch.tensor(weights, dtype=torch.float32)


class FocalLoss(nn.Module):
    """Multi-class focal loss (Lin et al., 2017): down-weights well-classified
    examples so training focuses on hard/rare examples, which is the other
    (non-reweighting) standard approach to class imbalance this block asks to
    benchmark against class-weighted cross-entropy. gamma=0 reduces exactly to
    (optionally class-weighted) cross-entropy — used as a sanity check in
    tests, not just an implementation detail."""

    def __init__(self, gamma: float = 2.0, class_weights: torch.Tensor | None = None) -> None:
        super().__init__()
        self.gamma = gamma
        self.register_buffer("class_weights", class_weights, persistent=False)

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        log_probs = torch.log_softmax(logits, dim=-1)
        probs = log_probs.exp()

        target_log_probs = log_probs.gather(1, targets.unsqueeze(1)).squeeze(1)
        target_probs = probs.gather(1, targets.unsqueeze(1)).squeeze(1)

        focal_term = (1 - target_probs).clamp(min=0) ** self.gamma
        loss = -focal_term * target_log_probs

        class_weights = self.class_weights
        if isinstance(class_weights, torch.Tensor):
            sample_weights = class_weights[targets]
            loss = loss * sample_weights
            # Normalize by the sum of weights actually used in this batch
            # (not the raw count) — matches nn.CrossEntropyLoss's own
            # weighted-mean reduction behavior, so switching between the two
            # loss functions doesn't also silently change the effective
            # learning rate via a differently-scaled loss magnitude.
            denom = sample_weights.sum().clamp(min=1e-8)
            return loss.sum() / denom

        return loss.mean()


def build_loss_function(
    loss_name: str,
    class_weights: torch.Tensor | None = None,
    focal_gamma: float = 2.0,
) -> nn.Module:
    """Builds one of the three benchmark loss candidates
    (config.VALID_LOSS_FUNCTIONS). class_weighted_cross_entropy and
    focal_loss both require class_weights/None to be resolved by the caller
    from the TRAINING split's class distribution specifically (never the
    validation or test split's) — using eval-set statistics to weight the
    training loss would leak information about the evaluation distribution
    into the training process."""
    if loss_name == "cross_entropy":
        return nn.CrossEntropyLoss()
    if loss_name == "class_weighted_cross_entropy":
        if class_weights is None:
            raise ValueError("class_weighted_cross_entropy requires class_weights")
        return nn.CrossEntropyLoss(weight=class_weights)
    if loss_name == "focal_loss":
        return FocalLoss(gamma=focal_gamma, class_weights=class_weights)
    raise ValueError(f"Unknown loss function '{loss_name}'")
