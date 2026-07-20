# MBOYO Model Evaluation, Calibration, and Export Methodology

This document describes how MBOYO evaluates a chosen model on the untouched test split, calibrates its probabilities, decides when to abstain, generates Grad-CAM explanations, applies the release gate, and exports the model for serving. It complements [BENCHMARK_METHODOLOGY.md](BENCHMARK_METHODOLOGY.md) (which selects an architecture) — this document covers what happens to a single already-selected model afterward.

See also: [`docs/product/SUCCESS_METRICS.md`](../docs/product/SUCCESS_METRICS.md) (release gate, Advisory-Only Fallback), [`docs/product/RISK_REGISTER.md`](../docs/product/RISK_REGISTER.md) risk #4 (Poor Image Quality), [`docs/product/STATE_MACHINES.md`](../docs/product/STATE_MACHINES.md) (`needs_manual_review` transitions), and [AGENTS.md](../AGENTS.md)'s ML honesty rules.

## Never evaluate on training or validation data as final evidence

`ml/src/training/evaluate.py`'s `run_untouched_test_evaluation` accepts a validation split (`val_rows`) and a test split (`test_rows`) with clearly separated roles:

- **Validation split** — used *only* to fit temperature scaling (`calibration.py`'s `fit_temperature`) and per-class confidence thresholds (`fit_per_class_thresholds`). Never scored or reported as a final metric.
- **Test split** — scored *exactly once*, after calibration parameters are already fixed. Every metric in the generated evaluation report (confusion matrix, macro/micro/weighted F1, destroyed recall, per-class metrics, PR curves, calibration curve, ECE, abstention rate, robustness) comes from this one pass.

This separation is structural, not just a convention documented in prose: `run_untouched_test_evaluation` computes calibration parameters from `val_rows` first, then applies them (never refits) when scoring `test_rows`.

## Untouched-test-set evaluation

Computed via `ml/src/training/metrics.py` and `evaluate.py`, all measured — never fabricated, per AGENTS.md:

- **Confusion matrix** (`compute_confusion_matrix`) — row-true, column-predicted, full error pattern rather than a single scalar.
- **Macro/micro/weighted F1** (`ClassificationMetrics.macro_f1` / `.micro_f1` / `.weighted_f1`) — macro per `SUCCESS_METRICS.md`'s definition (all 5 classes weighted equally); micro and weighted are additional views for different questions ("overall accuracy-like rate" and "frequency-weighted average" respectively).
- **Destroyed recall** — `None` (never a fabricated `0.0`) when the test split has zero destroyed-class examples.
- **Per-class precision/recall/F1/support** and **fitted confidence threshold** per class.
- **Precision-recall curves** (`compute_precision_recall_curves`) — one-vs-rest per class, from the full softmax output, not just the top-1 prediction.
- **Calibration curve** (`compute_calibration_curve`) — the reliability-diagram data behind the scalar ECE, one point per non-empty confidence bin.
- **Expected Calibration Error (ECE)** — computed on temperature-scaled probabilities, so the reported number reflects the calibrated model actually served, not the raw pre-calibration output.
- **CPU latency percentiles and model size** — reused directly from BLOCK 19's `latency.py`/`models.py`/`checkpoints.py` (no duplicated implementation).
- **Robustness by blur/darkness/compression/resolution** — reuses BLOCK 19's `robustness.py`, extended in this block with a fourth degradation, `low_resolution` (downscale-then-upscale, simulating a low-resolution capture) alongside the existing `gaussian_blur`/`low_light`/`jpeg_compression_artifact`.
- **Abstention rate** — the global-threshold rate (`compute_abstention_rate`), plus per-sample abstention *reasons* (see below), which a scalar rate alone cannot show.

## Probability calibration and per-class thresholds

`ml/src/training/calibration.py` implements **temperature scaling** (Guo et al., 2017): a single scalar `T`, fit by minimizing validation negative log-likelihood via LBFGS, divides the model's logits before softmax. This changes confidence sharpness without changing the predicted class (verified directly: `apply_temperature`'s argmax is invariant to `T`), so accuracy/macro-F1 are unaffected by calibration — only ECE and abstention behavior change.

**Per-class confidence thresholds** (`fit_per_class_thresholds`) replace BLOCK 19's single global `abstention_confidence_threshold` with one threshold per class: for each class, the lowest confidence threshold whose validation-set precision (among predictions at or above that threshold) still meets a configured target precision. Classes the model separates cleanly get a lower threshold (more of its confident predictions are trusted); classes it confuses more get a stricter one. A class with too few validation predictions to fit a threshold reliably (fewer than 5 kept at every candidate threshold) falls back to the configured default rather than fitting an unreliable number from a handful of samples.

## Abstain / `needs_manual_review` policy

`ml/src/training/abstention.py` implements the ML-side decision behind `docs/product/STATE_MACHINES.md`'s already-designed `needs_manual_review` transitions ("inference fails / advisory-only / low confidence" and "quality/duplicate signal flags it") — this module decides *when* an individual prediction should abstain; it does not invent the state itself.

Four independent signals, **any** of which triggers abstention (never averaged against each other — a confident-looking but out-of-distribution input must still abstain):

1. **Low confidence** — top-1 probability below the per-class (or global default) threshold.
2. **High entropy** — Shannon entropy of the full softmax distribution above a configured ceiling, catching a "flat" prediction that happens to clear the confidence bar on a technicality.
3. **Out-of-distribution (OOD) signal** — Euclidean distance from a sample's feature vector to its predicted class's training-set feature centroid (`FeatureCentroidOodDetector`), a deliberately simple, explainable proxy — **not** a state-of-the-art OOD method, and never described as a certainty measure, only a contributing signal.
4. **Quality-gate failure** — a per-report quality score below a floor, per RISK_REGISTER.md risk #4 ("low-quality inputs should trigger the abstention path... rather than a falsely confident classification").

Abstaining never means "reject the report" — per AGENTS.md's ML honesty rules, model outputs are probabilistic signals for human verifiers, not final determinations; abstaining means "do not offer a confident classification, route to full manual review instead." Every abstention reason is surfaced (never hidden), since "why did the model abstain" is itself useful review context.

**Known limitation:** `run_evaluate.py`'s CLI currently passes a neutral `1.0` placeholder quality score for every test-split image, since no real per-report quality-score pipeline is wired into this CLI yet (BLOCK 18's `data_governance` computes quality signals at the manifest-preparation stage, not as a reusable per-image function this CLI calls). `evaluate.py`'s `run_untouched_test_evaluation` itself accepts real quality scores via its `quality_scores_by_test_index` parameter — the seam is deliberately exposed so a future block can wire in the real signal without changing this module's interface.

## Grad-CAM explainability

`ml/src/training/gradcam.py` implements Grad-CAM (Selvaraju et al., 2017) from scratch in pure PyTorch: forward/backward hooks on the last layer of the model's `.features` submodule (the same submodule every benchmark architecture exposes uniformly, per `models.py`), gradient-weighted feature-map combination, ReLU, and bilinear upsampling to input resolution.

**Pure Pillow overlay, no OpenCV**: most Grad-CAM implementations (including `pytorch-grad-cam`) use `cv2.applyColorMap`/`cv2.resize` for the heatmap overlay. Since `opencv-python-headless` is confirmed unusable in this environment (NumPy 2.x ABI incompatibility, per BLOCK 19's `robustness.py`), the overlay (`render_overlay`) is hand-rolled: a small blue→yellow→red colormap LUT plus `PIL.Image.blend`, verified end-to-end to produce a correctly-sized, correctly-colored overlay.

**The non-causal disclaimer** (`GRAD_CAM_DISCLAIMER`, attached to every `GradCamResult` and printed by `run_export.py`) is load-bearing, not decorative: Grad-CAM shows *correlation* between image regions and the model's output, computed via gradients — it is not a causal explanation, a highlighted region is not proof of damage, and it does not indicate the prediction is correct. This must be surfaced verbatim (or translated, never paraphrased into a stronger claim) wherever a Grad-CAM overlay is shown, per AGENTS.md's "model outputs are probabilistic signals, not final determinations" rule applied to explainability specifically.

**A regression worth documenting:** Grad-CAM backpropagates into an intermediate activation, not the model's parameters. A model whose backbone was frozen (`set_backbone_trainable(model, False)`, BLOCK 19's transfer-learning pattern) has every parameter at `requires_grad=False`; with nothing in the graph requiring grad, `.backward()` fails. Fixed by forcing the *input tensor* (not any parameter) to require grad inside `compute_grad_cam`, guaranteeing the graph exists regardless of the model's own frozen/unfrozen state — verified directly by reproducing the failure with a frozen model, then confirming the fix.

No consumer UI or `model_explanations.explanation_type` convention exists yet for Grad-CAM output (confirmed via research: the table exists, generically shaped, with no reserved `explanation_type` values) — this block generates real Grad-CAM PNG samples (`run_export.py`'s `_generate_gradcam_samples`, real test-split images, never fabricated) to disk under `ml/models/<version>_gradcam_samples/`, for a future block's Verifier-tooling work to consume.

## Release gates and advisory-only registration

`ml/configs/release_criteria.yaml` (new in this block) is "the current `ml/configs/` release criteria file" `SUCCESS_METRICS.md`'s Release Gate section explicitly defers to. **These thresholds are a documented, defensible starting point — not empirically derived**, since no real trained model exists yet (`ml/data/raw/` remains genuinely empty, per BLOCK 18/19's own disclosed state): `macro_f1_min: 0.75`, `destroyed_recall_min: 0.60`, `calibration_error_max: 0.10`, `min_test_set_sample_count: 30`. This mirrors `selection_rule.py`'s own provisional-threshold precedent from BLOCK 19. A future evaluation against real data should revisit these explicitly, never silently.

`ml/src/training/release_gate.py`'s `evaluate_release_gate` applies **all three metric gates plus a minimum-sample-count gate**, never traded off against each other:

1. Test set must have at least `min_test_set_sample_count` samples (an evaluation on too few images can pass every numeric gate by chance).
2. `macro_f1` ≥ `macro_f1_min`.
3. `destroyed_recall` must be computable and ≥ `destroyed_recall_min`.
4. `calibration_error` (ECE) ≤ `calibration_error_max`.

Failing **any** gate marks the model `is_advisory_only: true` (mirroring the exact field name on `model_predictions.is_advisory_only` in the Supabase schema) — never "close enough," never a partial pass. Per `SUCCESS_METRICS.md`'s Advisory-Only Fallback: an advisory-only model may still run inference, but the Verifier UI must display an explicit "belum lolos ambang evaluasi — gunakan sebagai referensi, bukan keputusan" indicator, and the Verifier's decision authority is never bypassed, defaulted, or pre-filled based on advisory-only output.

## Export: ONNX, TorchScript, metadata, preprocessing spec, checksum, runtime benchmark

`ml/src/training/export.py` produces, for a chosen model:

- **ONNX** (`export_onnx`) — the format `apps/ml-api`'s ONNX Runtime serving path expects (per ADR 0004 / `SUCCESS_METRICS.md`'s CPU p95 latency metric). Verified via `onnx.checker.check_model` and a real ONNX Runtime inference pass, not just a successful `torch.onnx.export` call.
- **TorchScript** (`export_torchscript`) — a PyTorch-native fallback/comparison artifact, via `torch.jit.trace` (sufficient since every benchmark architecture is a plain feed-forward CNN with no data-dependent control flow a trace could miss).
- **Metadata JSON** (`ExportManifest`) — field names deliberately mirror `model_registry_entries`/`model_evaluations`' exact Supabase column names (`version`, `artifact_path`, `trained_at`, `dataset_identity`, `macro_f1`, `destroyed_recall`, `calibration_error`, `evaluated_at`, `report_path`) so a future block wiring this into that table has no field-name translation to invent.
- **Preprocessing spec** (`PreprocessingSpec`) — resolution, ImageNet normalization mean/std, color mode, resize method: exactly what `dataset.py`'s `build_transform` applies at evaluation time, serialized so a serving system can replicate it exactly rather than re-deriving it from source.
- **SHA-256 checksums** (`compute_sha256_checksum`) of both the ONNX and TorchScript artifacts, streamed in chunks (artifacts can be tens of megabytes).
- **Runtime benchmark** (`benchmark_onnx_runtime_latency`) — measures the *actual* serving path (ONNX Runtime CPU execution provider on the exported artifact), not the raw PyTorch model (BLOCK 19's `latency.py` measures that, for architecture-selection purposes) — this is the number that matters for `SUCCESS_METRICS.md`'s deployed CPU p95 latency metric.

**Disclosed limitation:** uses the legacy (non-dynamo) `torch.onnx.export` path explicitly (`dynamo=False`). The newer `torch.export`-based exporter (PyTorch's default as of 2.9) requires the `onnxscript` package, which is not a listed `ml/` dependency; attempting the default path in this environment failed with `ModuleNotFoundError: No module named 'onnxscript'`, confirmed directly. The legacy path is deprecated but fully functional in the installed torch version — disclosed here since a future PyTorch upgrade may remove it entirely, at which point `onnxscript` would need to be added as a dependency.

**Also fixed in this block:** `onnx` itself (distinct from `onnxruntime`) was listed in `ml/pyproject.toml`'s dependencies since BLOCK 19 but was not actually installed in this environment (`ModuleNotFoundError: No module named 'onnx'`, confirmed directly) — installed via `pip install "onnx>=1.16.0"`, which also updated `ml_dtypes` (unrelated `tensorflow-intel` version-conflict warnings from pip are about a different, unrelated global package, not this project's dependencies).

## CPU smoke-test mode

`pnpm run ml:evaluate:smoke-test` and `pnpm run ml:export:smoke-test` mirror BLOCK 19's `run_benchmark.py --smoke-test` precedent exactly: train a tiny model on synthetic checkerboard data (never real images, generated fresh each run), then run the full evaluation/export pipeline against it, proving every step works end to end. Every generated artifact — the evaluation report, the export manifest's `version` field (prefixed `smoke-test-`), and printed console output — is explicitly labeled and must never be cited as a real result.

## Real evaluation/export runs

`pnpm run ml:evaluate` and `pnpm run ml:export` operate against a real checkpoint (from `ml/models/`, produced by a real BLOCK 19 training/benchmark run) and the real dataset manifest. **As of this document, no real checkpoint exists** (no real training data exists yet, per BLOCK 18/19's own disclosed state) — both commands detect this and exit 0 with an honest "no trained model exists yet" message, never fabricating a report or export, per this block's own "no fake metrics" requirement and AGENTS.md's ML honesty rules.

## Known limitations

- No real trained model or real training data exists yet — every number this session could produce is either a smoke-test (synthetic, explicitly labeled) result or the honest absence of a result.
- `ml/configs/release_criteria.yaml`'s thresholds are a documented starting point, not empirically validated against real evaluation data.
- The per-sample quality score fed into the abstention decision is a neutral `1.0` placeholder in `run_evaluate.py`'s CLI (see "Abstain / needs_manual_review policy" above) — the underlying `evaluate.py` module accepts real scores; only the CLI's current wiring is a placeholder.
- The out-of-distribution signal (`FeatureCentroidOodDetector`) is a deliberately simple proxy, not a state-of-the-art OOD method, and is not yet wired into `run_evaluate.py`'s CLI (the module exists and is tested; the CLI does not yet extract feature vectors to feed it).
- ONNX export uses the legacy `torch.onnx` exporter path (`dynamo=False`) since the new default path requires `onnxscript`, not currently a listed dependency.
- `opencv-python-headless` remains unusable in this environment (NumPy 2.x ABI incompatibility, per BLOCK 19) — Grad-CAM's overlay rendering uses pure Pillow instead, consistent with `robustness.py`'s established precedent.
- No consumer UI exists yet for Grad-CAM output (`model_explanations` table) or the advisory-only badge (`model_predictions.is_advisory_only`) — both are produced in a shape ready for a future Verifier-tooling block to consume.
