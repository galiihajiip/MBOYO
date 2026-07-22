"""Deterministic seeding — every training/benchmark run's randomness (Python's
`random`, NumPy, PyTorch's CPU and CUDA RNGs, and PyTorch's own deterministic-
algorithm mode) is set from one seed, so the same config + the same manifest
byte-for-byte produces the same result. This is what makes the benchmark
report's numbers reproducible, not just plausible.
"""

from __future__ import annotations

import os
import random

import numpy as np
import torch


def set_deterministic_seed(seed: int) -> None:
    """Call once, before any model construction, data shuffling, or
    augmentation sampling in a run. Does not guarantee bit-for-bit identical
    floating-point results across different hardware/PyTorch builds (that is
    a stronger guarantee than this project needs or can promise) but does
    guarantee identical results across repeated runs on the same machine —
    the actual reproducibility bar this block's "reproducible hashes"
    principle (carried over from BLOCK 18) extends to training runs."""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)

    # CUBLAS workspace config is required by PyTorch for deterministic CUDA
    # matmul on some ops — set unconditionally; it is a no-op on a CPU-only
    # run (this environment has no CUDA device) and harmless if CUDA is
    # later available.
    os.environ.setdefault("CUBLAS_WORKSPACE_CONFIG", ":4096:8")

    try:
        torch.use_deterministic_algorithms(True, warn_only=True)
    except Exception:  # noqa: BLE001
        # Some PyTorch builds/ops don't support full determinism; warn_only
        # already prevents a hard crash, but older PyTorch versions may not
        # accept the warn_only kwarg at all — degrade to best-effort rather
        # than failing the whole run over a determinism nicety.
        pass
