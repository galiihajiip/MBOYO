# MBOYO Model Benchmark Methodology

This document describes how MBOYO benchmarks and selects among candidate CV architectures for building-damage severity classification. It is the "documented composite selection rule" required alongside `ml/src/run_benchmark.py`'s generated reports.

See also: [DATA_CARD.md](DATA_CARD.md) (ground-level vs. satellite imagery scoping), [LABELING_GUIDE.md](LABELING_GUIDE.md), [`docs/product/SUCCESS_METRICS.md`](../docs/product/SUCCESS_METRICS.md) (release gate, metric definitions), [`docs/product/RISK_REGISTER.md`](../docs/product/RISK_REGISTER.md) risk #4 (Poor Image Quality) and risk #5 (Model Bias).

## Candidate architectures

Three torchvision ImageNet-pretrained backbones, transfer-learned with a freshly-initialized classification head sized to the 5 severity classes (`no_damage`, `minor_damage`, `major_damage`, `destroyed`, `unknown` — see [`packages/domain/src/enums.ts`](../packages/domain/src/enums.ts)'s `SEVERITY_CLASSES`, kept in exact lockstep):

- **MobileNetV3-Large** — the cheapest candidate by parameter count and latency; the reference architecture for Phase 1 (below).
- **EfficientNetV2-S** — a mid-size candidate balancing accuracy and efficiency.
- **ConvNeXt-Tiny** — the largest/most accuracy-oriented candidate.

## Ground-level imagery only

Every benchmark run in this document is against **ground-level, citizen-submitted phone photos** (or, until real data exists, explicitly-labeled synthetic stand-ins — see "CPU smoke-test mode" below). Per [DATA_CARD.md §1.1](DATA_CARD.md#11-ground-level-vs-satellite-imagery--do-not-conflate), no benchmark number here may ever be compared to, or presented alongside, a satellite/aerial-imagery benchmark as if the two measured the same task.

## Two-phase benchmark methodology

Running the full architecture × resolution × loss × sampler grid exhaustively means 3 × 2 × 3 × 2 = 36 full training runs. This is a disproportionate cost for tuning a hyperparameter (loss function, sampler) that is far cheaper to fix once than to re-tune per architecture. This is a **documented, deliberate scope decision**, confirmed with the user before implementation — not an oversight or a corner cut silently.

### Phase 1 — Loss/sampler selection

Fixes the architecture to **MobileNetV3-Large** (the cheapest candidate) at the **first configured resolution** (224px by default). Trains once per `loss_functions` entry in [`configs/training.yaml`](configs/training.yaml) (`cross_entropy`, `class_weighted_cross_entropy`, `focal_loss`), and once more with the `WeightedRandomSampler` enabled (if `sampler.weighted_random_sampler_candidate: true`) — a total of up to 4 short training runs. Whichever produced the best **validation macro-F1** is the loss/sampler choice carried into Phase 2.

This choice is never hidden: every candidate's validation macro-F1 is recorded in the generated report's "Phase 1" table, so a reader can see exactly what was compared and why the winner won — not just trust an assertion.

### Phase 2 — Architecture × resolution grid

Trains every `(architecture, resolution)` combination in `configs/training.yaml` using Phase 1's winning loss/sampler choice, then evaluates each on the **untouched test split** (BLOCK 18's group-aware `split.py` output — no image from the same source/geographic group ever appears in more than one split, preventing leakage). For each combination, computes:

- **Macro-F1** and **per-class precision/recall/F1** (all 5 classes, unweighted average).
- **Destroyed recall**, tracked separately per `SUCCESS_METRICS.md`'s own rationale.
- **Expected Calibration Error (ECE)**.
- **Abstention rate** at the configured confidence threshold.
- **CPU p50/p95/p99 inference latency** — always measured on CPU regardless of training device, since `apps/ml-api`'s serving path is CPU-only.
- **Model size** — both an in-memory parameter-count estimate and the actual on-disk checkpoint size (the latter is authoritative).
- **Robustness to image-quality degradation** — macro-F1 recomputed under Gaussian blur, simulated low light, and JPEG compression artifacts, each compared to the clean-image baseline. A drop is reported per-degradation, never averaged into one obscuring number.

## The composite selection rule

Implemented in [`ml/src/training/selection_rule.py`](src/training/selection_rule.py) — read that module's own docstring for the exact weights and formulas; summarized here:

### Step 1 — Hard gates (never traded off)

A candidate that fails either gate is **excluded from ranking entirely**, regardless of how good its other numbers are — mirroring `SUCCESS_METRICS.md`'s release-gate philosophy ("this gate cannot be waived by a strong macro-F1 alone") applied to architecture selection:

1. **Destroyed recall** must be computable (the test set must contain destroyed-class examples) and must meet or exceed a minimum acceptable floor.
2. **CPU p95 latency** must not exceed a maximum acceptable bound — a model too slow for the target CPU-only deployment is unusable regardless of accuracy.

### Step 2 — Composite score among gate-passing candidates

A weighted sum of six normalized (0–1, higher-is-better) sub-scores:

| Component | Weight | Rationale |
|---|---|---|
| Macro-F1 | 0.40 | The primary release-gate metric. |
| Destroyed recall | 0.25 | Tracked separately — "averaging can mask poor performance on this single highest-stakes class" (`SUCCESS_METRICS.md`). |
| Calibration (1 − ECE) | 0.15 | A miscalibrated model undermines Verifier trust even at high raw accuracy. |
| Latency (inverted, relative) | 0.10 | Faster is better once already fast enough to pass the hard gate. |
| Model size (inverted, relative) | 0.05 | Smaller is operationally easier to deploy/update; the least accuracy-relevant factor. |
| Robustness (1 − mean degradation drop) | 0.05 | A model that degrades badly under realistic poor-image-quality conditions is penalized, but lightly — a secondary signal to the primary accuracy metrics. |

**These weights are a documented, defensible starting point — not derived from real evaluation data (none exists yet) and not claimed to be optimal.** A future block with real benchmark results may revisit them; any revision must update this document and `selection_rule.py`'s own docstring together, explicitly, never silently.

## CPU smoke-test mode

`pnpm run ml:benchmark:smoke-test` (or `python ml/src/run_benchmark.py --smoke-test`) generates a tiny, entirely **synthetic** dataset (see [`ml/src/training/smoke_test_data.py`](src/training/smoke_test_data.py) — solid-colored checkerboard images per class, never real photographs), scoped down to one architecture, one resolution, one loss function, and a handful of epochs (see `training/config.py`'s `derive_smoke_test_training_config`), and runs the exact same training/benchmark/report code path as a real run.

Its purpose is **only** to prove the pipeline works end to end — every generated report is headed with an explicit, unmissable warning (`⚠️ SMOKE-TEST RUN`) and must never be cited as evidence of any architecture's real-world performance, per [AGENTS.md](../AGENTS.md)'s ML honesty rules and this block's own "dummy/synthetic data must be labeled" requirement (carried over from BLOCK 18).

## Real benchmark runs

`pnpm run ml:benchmark` (or `python ml/src/run_benchmark.py`) runs against `ml/configs/dataset.yaml`'s real `split.csv` manifest (BLOCK 18's `split.py` output). **As of this document, `ml/data/raw/` is empty — no real training data exists yet.** Running this command against the current repository state prints an honest "no data — cannot benchmark" message and exits 0, per this block's "empty data must exit gracefully" and "no fake metrics" requirements. This is not a placeholder or a stub: the exact same code that will produce a real benchmark report once real data exists is what runs today; it simply has nothing to report on yet.

## Optional two-stage quality/building-relevance gate

`configs/training.yaml`'s `two_stage_gate` section documents the planned shape of an optional lightweight binary pre-filter (real photo of a building, sufficient quality to judge damage) that would run before the 5-class severity classifier. It is `enabled: false` and **not currently runnable**: it requires a binary `is_valid_subject`-style label per image, which does not exist in BLOCK 18's manifest schema (`ManifestRow` has no such column). Implementing this gate for real is deferred to a future block that first extends the labeling schema — building it now against a label that doesn't exist would mean either fabricating labels (violating ML honesty rules) or building untestable code, neither of which is acceptable.

## Known limitations

- No real training data exists yet — every number this session could produce is either a smoke-test (synthetic, explicitly labeled) result or the honest absence of a result.
- The composite selection rule's weights are a documented starting point, not empirically validated.
- `opencv-python-headless` (a listed `ml/` dependency) currently fails to import in this development environment due to a NumPy 2.x ABI incompatibility (a pre-existing environment issue). The robustness-degradation module (`ml/src/training/robustness.py`) was written using pure Pillow specifically to avoid this dependency, so it is unaffected, but this is disclosed here since `opencv-python-headless` remains listed as a dependency for other future pipeline stages.
- Mixed precision (`torch.amp`) has not been exercised on a real CUDA device this session (no CUDA device is available in this environment) — its code path is written and conditional on `torch.cuda.is_available()`, but only the CPU (no-op) path has been verified end to end.
