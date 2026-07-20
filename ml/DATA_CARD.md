# MBOYO Damage-Classification Dataset — Data Card

This document describes the dataset used to train and evaluate MBOYO's building-damage severity classifier. It follows the spirit of standard dataset/model cards (Gebru et al., "Datasets for Datasheets"; Mitchell et al., "Model Cards") scoped to what this project actually has, not what a mature production dataset would have.

**As of this document, `ml/data/raw/` is empty. No training run has occurred. Every number in this document is either a schema/definition (fixed) or explicitly marked `TBD — populated once real data exists`.** Per [AGENTS.md](../AGENTS.md)'s ML honesty rules, this document must never assert a class distribution, image count, or performance figure that hasn't actually been measured.

## 1. Purpose and Scope

The dataset trains a single model: **ground-level, citizen-submitted damage-severity classification** for buildings/structures in a disaster context, feeding `model_prediction.severity_probabilities` (see [DOMAIN_MODEL.md](../docs/product/DOMAIN_MODEL.md)). It is **not** a general-purpose building-damage dataset and is **not** a satellite-imagery dataset.

### 1.1 Ground-level vs. satellite imagery — do not conflate

This is the single most important scoping note in this document, per this block's explicit instruction.

MBOYO's Reporter submits photos taken **on the ground, at close-to-medium range, from an uncontrolled angle, with a phone camera, often in poor lighting or motion-blur conditions** (see [RISK_REGISTER.md](../docs/product/RISK_REGISTER.md) risk #4). This is a fundamentally different visual domain from **satellite or aerial (drone/UAV) post-disaster imagery**, which is captured from directly overhead or a steep oblique angle, at a fixed altitude/resolution, without the framing, occlusion, motion blur, or lighting variance of a citizen photo.

Published damage-classification benchmarks (e.g. xBD, the SpaceNet building-damage challenges, and most academic post-disaster remote-sensing datasets) are overwhelmingly **satellite/aerial**. Their reported accuracy, F1, or IoU numbers describe a different task on a different visual distribution and **must never be cited, quoted, or implied as this model's expected or actual performance**. A model trained or pretrained on satellite imagery may still be used as a feature-extraction backbone (transfer learning), but:

- Any performance claim in [`ml/reports/`](./reports) must state which imagery domain (ground-level phone photo vs. satellite/aerial) the *evaluation* set — not just the training set — was drawn from.
- A macro-F1 or destroyed-recall number measured on a satellite benchmark, or on a mixed ground+satellite test set, must never be presented as "the MBOYO model's performance" without that domain breakdown, per [AGENTS.md](../AGENTS.md) ("no fabricated metrics... no cherry-picked examples presented as representative performance").
- [`configs/dataset.yaml`](configs/dataset.yaml)'s `image_domain` field and every manifest row's `image_domain` column exist specifically so this distinction survives into every downstream script (audit, split, evaluate) as structured data, not just a paragraph someone might skip.

## 2. Classes

Five severity classes, exactly matching `packages/domain/src/enums.ts`'s `SEVERITY_CLASSES` and [DOMAIN_MODEL.md](../docs/product/DOMAIN_MODEL.md) — this dataset introduces no class not already defined in the product's type system, and defines no fewer:

| Class | Definition (for labeling — see [LABELING_GUIDE.md](LABELING_GUIDE.md) for the full decision procedure) |
|---|---|
| `no_damage` | No visible structural damage. Cosmetic issues (dirt, pre-existing wear) do not count. |
| `minor_damage` | Visible but non-structural damage — cracked windows, damaged roofing/siding, debris on the property — the structure remains usable/habitable. |
| `major_damage` | Significant structural damage — partial collapse, severe structural cracking, missing walls/roof sections — the structure is not safely usable without repair. |
| `destroyed` | The structure has collapsed entirely or is reduced to rubble; little to no original structure remains standing. |
| `unknown` | The image does not permit a damage judgment — see [LABELING_GUIDE.md §Unknown vs. Abstention](LABELING_GUIDE.md#unknown-vs-abstention) for exactly when this applies. |

### 2.1 `unknown` is a label, not the model's abstention mechanism

`unknown` is a genuine class a human labeler can assign to a training image (e.g., a photo of an interior, a photo too dark/blurry to judge, an unrelated photo). It is **distinct** from the trained model's *abstention* behavior at inference time (declining to output a confident class when its own confidence is below threshold — [SUCCESS_METRICS.md](../docs/product/SUCCESS_METRICS.md) "Abstention rate"). A model can abstain on an image a human labeler would have confidently called `no_damage`; conversely, an image human-labeled `unknown` is valid *training signal* for "this input type should produce low confidence," not something to discard. Both concepts matter for calibration and must not be collapsed into one.

## 3. Composition

**TBD — populated once real data exists.** When populated, this section must report (per class, and per `image_domain`/source where feasible, per [RISK_REGISTER.md](../docs/product/RISK_REGISTER.md) risk #5 "Model Bias" stratification requirement):

- Total image count.
- Per-class image count and percentage (see `ml/reports/class_audit_<date>.json`, produced by `ml/src/audit.py`).
- Per-source breakdown (see §4).
- Image dimension distribution (min/max/median width, height — produced by `audit.py`).
- Geographic distribution, to the precision available per source's license/consent (see §5 and [ETHICS_AND_PRIVACY.md](ETHICS_AND_PRIVACY.md)).

## 4. Sources

See [`data/manifests/SOURCES.md`](data/manifests/SOURCES.md) for the full source/license manifest — every source this dataset may draw from, its license, and its **inclusion status**. No source is included in this dataset unless its license/terms are read and recorded there first; this repository's automation must never auto-download a dataset whose license has not been explicitly verified and logged (see §6 and `ml/src/prepare_data.py`'s manifest-required-before-fetch check).

## 5. Consent, Privacy, and Sensitive Content

See [`ETHICS_AND_PRIVACY.md`](ETHICS_AND_PRIVACY.md) for the full policy. Summary: any image containing an identifiable face, a legible identity/license document, or a deceased person is flagged (`ml/src/audit.py`'s privacy-flag pass) for exclusion or manual review before it may enter a training/eval split — this dataset does not knowingly train on identifiable individuals' images without a lawful basis recorded in the source manifest.

## 6. Known Limitations (update as they become concretely true, not preemptively assumed away)

- **No real data yet.** Every script in this pipeline (`prepare_data.py`, `audit.py`, `split.py`, `deduplicate.py`) is written to run correctly against zero images (exiting gracefully, producing an explicit "no data" report) — see each script's own docstring.
- **Synthetic/dummy data, if used for pipeline development or CI, is always labeled as such** in its manifest row's `is_synthetic: true` field and is never mixed into a real train/val/test split without that flag surviving the split (`split.py` refuses to silently drop or merge the flag).
- Class boundaries (`minor_damage` vs. `major_damage` especially) are inherently subjective at the margins — see [LABELING_GUIDE.md](LABELING_GUIDE.md)'s inter-labeler agreement and adjudication procedure, which exists specifically because this boundary is not mechanically decidable from a single label.

## Maintenance

This document must be updated (not just the TBD sections filled in, but re-reviewed) every time `configs/dataset.yaml`'s class list, source list, or split ratios change, and every time a new source is added to `data/manifests/SOURCES.md`.
