"""CPU inference latency measurement — one of this block's explicit
selection criteria. Always measured on CPU regardless of what device the
model was trained on, since apps/ml-api's actual serving path is CPU-only
(docs/product/SUCCESS_METRICS.md: "most deployment environments for this
capstone are CPU-only; GPU latency is not representative of the target
deployment") — measuring on whatever device happened to train the model
would misrepresent the metric this benchmark exists to inform.
"""

from __future__ import annotations

import time
from dataclasses import dataclass

import numpy as np
import torch
from torch import nn


@dataclass(frozen=True)
class LatencyMeasurement:
    p50_ms: float
    p95_ms: float
    p99_ms: float
    mean_ms: float
    sample_count: int
    batch_size: int
    resolution_px: int


def measure_cpu_latency(
    model: nn.Module,
    resolution_px: int,
    batch_size: int = 1,
    num_warmup_runs: int = 5,
    num_measured_runs: int = 30,
) -> LatencyMeasurement:
    """Runs `num_warmup_runs` untimed forward passes (to let PyTorch's
    internal caches/thread pools stabilize — the first few calls are
    reliably slower and would skew a p50/p95 measurement if included), then
    times `num_measured_runs` more. Model is moved to CPU and set to eval
    mode for the duration of this measurement regardless of its current
    device/mode, and restored to its prior device afterward — this function
    must never leave the caller's model in a different device/mode than it
    found it in."""
    original_device = next(model.parameters()).device
    original_training_mode = model.training

    model.eval()
    model.to("cpu")

    dummy_input = torch.randn(batch_size, 3, resolution_px, resolution_px)

    with torch.no_grad():
        for _ in range(num_warmup_runs):
            model(dummy_input)

        durations_ms: list[float] = []
        for _ in range(num_measured_runs):
            start = time.perf_counter()
            model(dummy_input)
            end = time.perf_counter()
            durations_ms.append((end - start) * 1000)

    model.to(original_device)
    model.train(original_training_mode)

    durations_array = np.array(durations_ms)
    return LatencyMeasurement(
        p50_ms=float(np.percentile(durations_array, 50)),
        p95_ms=float(np.percentile(durations_array, 95)),
        p99_ms=float(np.percentile(durations_array, 99)),
        mean_ms=float(np.mean(durations_array)),
        sample_count=num_measured_runs,
        batch_size=batch_size,
        resolution_px=resolution_px,
    )
