from __future__ import annotations

import pytest
import torch
from torch import nn

from training.losses import FocalLoss, build_loss_function, compute_class_weights


def test_compute_class_weights_balanced() -> None:
    weights = compute_class_weights({"a": 10, "b": 10}, ("a", "b"))
    assert torch.allclose(weights, torch.tensor([1.0, 1.0]))


def test_compute_class_weights_inverse_frequency() -> None:
    weights = compute_class_weights({"rare": 5, "common": 20}, ("rare", "common"))
    # rare has 1/4 the frequency of common -> should get a higher weight.
    assert weights[0] > weights[1]


def test_compute_class_weights_zero_count_gets_zero_weight() -> None:
    weights = compute_class_weights({"present": 10, "absent": 0}, ("present", "absent"))
    assert weights[1].item() == 0.0
    assert not torch.isnan(weights).any()
    assert not torch.isinf(weights).any()


def test_focal_loss_gamma_zero_matches_cross_entropy() -> None:
    torch.manual_seed(0)
    logits = torch.randn(16, 5)
    targets = torch.randint(0, 5, (16,))

    ce_loss = nn.CrossEntropyLoss()(logits, targets)
    focal_loss = FocalLoss(gamma=0.0)(logits, targets)

    assert torch.allclose(ce_loss, focal_loss, atol=1e-5)


def test_focal_loss_with_class_weights_matches_weighted_cross_entropy_at_gamma_zero() -> None:
    torch.manual_seed(0)
    logits = torch.randn(16, 5)
    targets = torch.randint(0, 5, (16,))
    weights = torch.tensor([1.0, 0.5, 2.0, 1.0, 1.0])

    ce_loss = nn.CrossEntropyLoss(weight=weights)(logits, targets)
    focal_loss = FocalLoss(gamma=0.0, class_weights=weights)(logits, targets)

    assert torch.allclose(ce_loss, focal_loss, atol=1e-5)


def test_focal_loss_downweights_confident_correct_predictions() -> None:
    """A very confident, correct prediction should contribute a much smaller
    focal loss than an unconfident/wrong one — the whole point of focal loss."""
    confident_correct_logits = torch.tensor([[10.0, -10.0]])
    unconfident_wrong_logits = torch.tensor([[0.1, -0.1]])
    target = torch.tensor([0])

    loss_fn = FocalLoss(gamma=2.0)
    confident_loss = loss_fn(confident_correct_logits, target)
    unconfident_loss = loss_fn(unconfident_wrong_logits, target)

    assert confident_loss.item() < unconfident_loss.item()


def test_build_loss_function_cross_entropy() -> None:
    loss_fn = build_loss_function("cross_entropy")
    assert isinstance(loss_fn, nn.CrossEntropyLoss)


def test_build_loss_function_class_weighted_requires_weights() -> None:

    with pytest.raises(ValueError, match="requires class_weights"):
        build_loss_function("class_weighted_cross_entropy", class_weights=None)


def test_build_loss_function_focal() -> None:
    loss_fn = build_loss_function("focal_loss", focal_gamma=3.0)
    assert isinstance(loss_fn, FocalLoss)
    assert loss_fn.gamma == 3.0


def test_build_loss_function_unknown_raises() -> None:

    with pytest.raises(ValueError, match="Unknown loss function"):
        build_loss_function("not_a_real_loss")
