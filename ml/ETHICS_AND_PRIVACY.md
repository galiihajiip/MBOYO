# MBOYO ML Dataset — Ethics and Privacy Policy

This document governs what data may enter this dataset, under what license/consent basis, and how privacy-sensitive content is handled. It applies to every image reachable from `ml/data/raw/` regardless of source. See also [RISK_REGISTER.md](../docs/product/RISK_REGISTER.md) risk #10 (Sensitive Imagery) and risk #5 (Model Bias), and [THREAT_MODEL.md](../docs/security/THREAT_MODEL.md).

## 1. Licensing policy

**No dataset or individual image may be downloaded or added to this repository's data pipeline unless its license or usage terms have been read and recorded in [`data/manifests/SOURCES.md`](data/manifests/SOURCES.md) first.** This is enforced structurally, not just documented as a rule:

- `ml/src/prepare_data.py` refuses to ingest any source directory not listed in `SOURCES.md` with a non-empty `license` field — an unlisted or license-blank source causes the script to skip that source and report it as excluded, never to silently include it.
- "Unclear license" (a source whose terms are ambiguous, unstated, or require an interpretation call) is treated the same as "no license" — excluded, logged, and flagged for a human licensing decision before it can be added. Automation never makes this judgment call.
- This project never scrapes or bulk-downloads imagery from the open web, social media, or news sites without an explicit per-source license review — "publicly visible" is not the same as "licensed for ML training use," and this pipeline does not treat it as such.
- MBOYO's own Reporter-submitted evidence photos (`report_evidence` table) are governed by the product's own Privacy Policy and Terms of Service (see the app's `/privacy` page), not by this document's third-party-source policy — if/when Reporter-submitted photos are used for training, that requires a separate, explicit consent-basis decision recorded in `SOURCES.md` under a dedicated entry, not an implicit assumption that "we have the photos so we can train on them."

## 2. Consent basis per source

Every entry in `SOURCES.md` must record one of:

- **Public-domain / CC0** — no consent question, but license terms still recorded for provenance.
- **Permissively licensed with attribution** (e.g. CC-BY) — attribution obligation recorded and honored in any published model card.
- **Explicit research/institutional agreement** — the agreement's scope (research use only? redistribution allowed? training use explicitly covered?) recorded, not assumed from the dataset's general reputation.
- **First-party consent** (e.g. a future MBOYO Reporter opt-in for training use) — the consent mechanism and its scope recorded; this basis does not exist yet as of this document (no such opt-in flow has been built).

An entry with none of the above recorded is not eligible for inclusion.

## 3. Privacy-sensitive content

### 3.1 What is flagged

`ml/src/audit.py`'s privacy pass flags any image where a labeler or the (optional, described below) automated pass identifies:

- An identifiable human face (a face where an individual could plausibly be recognized — not merely "a person is visible," e.g. a distant figure with no discernible features does not trigger this).
- A legible identity document (ID card, passport, license plate readable at a level that identifies a specific person or vehicle).
- A deceased person, regardless of identifiability — this is a dignity concern independent of privacy identifiability.

### 3.2 What happens to a flagged image

A flagged image is **excluded from any split by default** (`split.py` drops `privacy_flag: true` rows unless explicitly overridden with a documented reason) — it is not automatically deleted from `ml/data/raw/` (raw data is immutable per [DATA_CARD.md](DATA_CARD.md)/`prepare_data.py`'s design), but it never reaches `ml/data/processed/` or a train/val/test manifest without a recorded human decision to include it (e.g., after cropping/blurring the sensitive region — a mitigation this pipeline does not currently implement automatically, disclosed here rather than assumed solved, consistent with [RISK_REGISTER.md](../docs/product/RISK_REGISTER.md) risk #10's "this register does not currently define automated sensitive-content detection").

### 3.3 Automated privacy flagging is a heuristic, not a guarantee

If an automated face/document detector is used to assist the privacy-flag pass (see `ml/src/audit.py --privacy-scan`), its output is a **candidate flag for human review**, never a final inclusion/exclusion decision by itself, and its absence of a detection is never treated as proof an image contains no sensitive content — a missed detection is a false negative the pipeline does not claim to catch. This mirrors [AGENTS.md](../AGENTS.md)'s "model outputs are probabilistic signals... not final determinations" applied to a detector used in the data pipeline itself, not just the production classifier.

## 4. Deceased persons and traumatic content

Disaster imagery may depict injury, death, or acute distress. Beyond the identifiability concern in §3.1, any image depicting a deceased person or graphic injury is excluded from the training/eval dataset regardless of consent/license status for that source — this is a dignity and appropriateness boundary, not a licensing one, and is not waivable by a source's general license terms.

## 5. Geographic and demographic disclosure

Per [RISK_REGISTER.md](../docs/product/RISK_REGISTER.md) risk #5 (Model Bias), dataset composition should be stratifiable by geography/source where feasible — but geographic precision recorded in the manifest is capped at whatever precision the source's license/consent basis actually covers (e.g., "province" rather than exact GPS coordinates, unless the source's consent explicitly covers precise-location disclosure). Over-precise geographic metadata is not collected just because a source happens to provide it if the consent basis doesn't clearly cover that level of disclosure.

## 6. Synthetic/dummy data

Any synthetic or placeholder image used to exercise this pipeline before real data exists (e.g., for CI or local testing of `audit.py`/`split.py`/`deduplicate.py`) is marked `is_synthetic: true` in its manifest row. Synthetic data carries no privacy risk by construction (nothing in it depicts a real person or place) but is still logged, per this block's explicit "dummy/synthetic data must be labeled" requirement, so it can never be silently mistaken for real evaluation data in a report.

## 7. Review cadence

This document should be re-read (not just referenced) whenever a new source is proposed for `SOURCES.md`, and whenever the privacy-flag heuristics in `audit.py` change.
