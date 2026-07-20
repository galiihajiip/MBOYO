# Dataset Source and License Manifest

Every data source this project's pipeline may ingest must have an entry here, added **before** any script downloads or reads from it, per [`ETHICS_AND_PRIVACY.md`](../../ETHICS_AND_PRIVACY.md) section 1. `ml/src/prepare_data.py` reads this file and refuses to ingest any raw-data subdirectory (`ml/data/raw/<source_id>/`) whose `source_id` is not listed below with a non-empty, non-"unclear" license.

**As of this document, no source is registered — `ml/data/raw/` is empty and no dataset has been added.** This is the honest, current state; do not add a placeholder/example entry as if it were real (see [AGENTS.md](../../../AGENTS.md) ML honesty rules — this applies to dataset provenance claims exactly as it does to metrics).

## How to add a source

1. Read the source's actual license/terms of use — not a summary, not an assumption from the dataset's reputation.
2. Determine the consent basis per [ETHICS_AND_PRIVACY.md](../../ETHICS_AND_PRIVACY.md) section 2. If it doesn't clearly fit one of the four documented bases, it is **not eligible** — do not force-fit an ambiguous case into the nearest-sounding category.
3. Add a row to the table below with every column filled — no column may be left blank or "TBD" for a source that is actually being added (a source still under evaluation does not get a row yet; evaluate it outside this file until the decision is made).
4. Create `ml/data/raw/<source_id>/` and place files there — `prepare_data.py` will refuse to process any other directory name.
5. Record the `image_domain` (`ground_level` or `satellite_aerial`, per [DATA_CARD.md §1.1](../../DATA_CARD.md#11-ground-level-vs-satellite-imagery--do-not-conflate)) — a source that mixes both must be split into two `source_id` entries, one per domain, never merged under one row.

## Source table

| `source_id` | Description | License | Consent Basis | `image_domain` | Geographic Precision Permitted | Date Added | Added By |
|---|---|---|---|---|---|---|---|
| _(none yet)_ | | | | | | | |

## Rejected / excluded sources

A source that was evaluated and explicitly rejected (unclear license, consent basis doesn't cover training use, etc.) is logged here — not silently omitted — so the same source isn't re-evaluated from scratch later, and so an auditor can see that exclusion was a deliberate decision, not an oversight.

| `source_id` (proposed) | Reason excluded | Date | Decided By |
|---|---|---|---|
| _(none yet)_ | | | |
