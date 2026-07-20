# MBOYO Success Metrics

All metrics here follow the [ML Honesty and Evaluation Rules](../../AGENTS.md#ml-honesty-and-evaluation-rules): no number is promised before it is measured on an untouched test set or a genuine end-to-end run, and every reported figure is labeled with its evaluation date and dataset/run.

## Product and Operational Metrics

### Report completion rate
Definition: percentage of report creation attempts (photo + GPS captured, form started) that result in a saved-to-queue report, regardless of sync status.
Target: measured post-MVP from real usage/demo sessions; no fixed target asserted before data exists.
Why it matters: a low rate indicates friction in the offline-capable creation flow itself, independent of network conditions.

### Offline queue success rate
Definition: percentage of reports created while offline that successfully sync (exactly once, without data loss) upon reconnect.
Target: 100% is the correctness bar for idempotent sync (this is a correctness invariant, not an aspirational metric) — any measured rate below 100% is a bug, not a KPI to trend.

### Duplicate prevention rate
Definition: percentage of true duplicate reports (same incident, multiple reporters/submissions) correctly flagged to the Verifier before they become separate operational tasks.
Target: measured empirically once duplicate-detection logic exists (Enhanced Demo tier); no figure asserted at MVP.

### Sync latency
Definition: time from network reconnect to server-confirmed sync completion for a queued report.
Target: reported as a measured distribution (p50/p95) from real test runs, not a promised number.

### Verification SLA
Definition: time from analysis job completion to Verifier decision (confirm/override/reject/escalate).
Target: tracked per event/demo session; no fixed SLA promised until operational data exists across multiple sessions.

### Task SLA
Definition: time from incident verification to first response task creation, and from task creation to task completion/closure.
Target: tracked per event/demo session; same caveat as Verification SLA.

## ML Model Metrics

All ML metrics below are measured on a held-out test set that the model has never seen during training or hyperparameter tuning, and are dated to the evaluation run that produced them. A metric without an evaluation report in `ml/reports/` backing it must not appear in any product copy, pitch material, or UI.

### Macro-F1
Definition: unweighted average F1 across all severity classes (`unknown`, `no_damage`, `minor_damage`, `major_damage`, `destroyed`), treating each class equally regardless of frequency — chosen because operational cost of missing a rare severe class outweighs raw accuracy on common classes.

### Destroyed recall
Definition: recall specifically on the `destroyed` class — the class where a false negative (missing a destroyed structure) has the highest real-world cost.
Rationale: tracked separately from macro-F1 because averaging can mask poor performance on this single highest-stakes class.

### Calibration error
Definition: expected calibration error (ECE) between the model's reported confidence and its empirical accuracy at that confidence level.
Rationale: Verifiers rely on probabilities to decide how much scrutiny to apply; a miscalibrated model (e.g., consistently overconfident) undermines that trust even if raw accuracy is acceptable.

### Abstention rate
Definition: percentage of inputs for which the model's output falls below the confidence threshold required to offer a classification, routing instead to "insufficient confidence — full manual review" for the Verifier.
Rationale: an honest model should decline to guess on out-of-distribution or low-quality inputs rather than emit a confident wrong answer.

## Infrastructure Metrics

### CPU p95 inference latency
Definition: 95th-percentile latency of a single `apps/ml-api` inference call on the deployed CPU inference path (ONNX Runtime), measured under representative concurrent load.
Rationale: most deployment environments for this capstone are CPU-only; GPU latency is not representative of the target deployment.

### Accessibility
Definition: automated (axe-core or equivalent) and manual keyboard/screen-reader pass/fail results against WCAG 2.1 AA success criteria, per role UI.
Target tier: baseline pass at Enhanced Demo tier ([MVP_SCOPE.md](MVP_SCOPE.md)); full AA conformance at Production tier.

### Web performance
Definition: Core Web Vitals (LCP, INP, CLS) measured on representative mid-range mobile hardware and throttled network profiles (given Reporter's field device/connectivity profile).
Target: no promised number before measurement; measured and reported per release.

### Demo reliability
Definition: percentage of scripted demo run-throughs (the MVP live flow, executed live, no shortcuts) that complete without manual intervention or fallback to `DEMO_MODE`.
Rationale: this is the metric most directly tied to hackathon presentation risk — tracked explicitly rather than assumed.

## Release Gate

A trained model may be promoted from `ml/models/` candidate to the version served by `apps/ml-api` in anything other than an explicitly labeled experimental/internal context only if **all** of the following hold, evaluated on the untouched test set:

1. Macro-F1 meets or exceeds the threshold defined in the current `ml/configs/` release criteria file (threshold is set and versioned in that config, not in this document, so it can evolve without a docs edit).
2. Destroyed recall meets or exceeds its configured floor — this gate cannot be waived by a strong macro-F1 alone, since averaging can mask a weak `destroyed` class.
3. Calibration error is within the configured bound.
4. The evaluation report is checked into `ml/reports/` with dataset identity, date, and model version recorded.

### Advisory-Only Fallback

If a candidate model fails the release gate, or if no model has yet passed it:

- `apps/ml-api` may still run inference, but its output is labeled and treated as **advisory-only**: the Verifier UI must display it with an explicit "belum lolos ambang evaluasi — gunakan sebagai referensi, bukan keputusan" (has not passed the evaluation threshold — use as reference, not decision) indicator.
- The Verifier's confirm/override/reject decision is never blocked, defaulted, or pre-filled based on advisory-only output.
- This fallback is distinct from `DEMO_MODE`: advisory-only is a real, disclosed model-quality state; `DEMO_MODE` is a demo-environment toggle. Both must be visibly labeled but they are not the same mechanism and must not be conflated in the UI or code.
