# MBOYO Damage-Severity Labeling Guide

This guide governs how a human labeler assigns one of the five [DATA_CARD.md](DATA_CARD.md) classes to a training/evaluation image. It exists so that (a) different labelers converge on similar judgments for similar images (inter-labeler agreement, measured by `ml/src/audit.py`), and (b) disagreements are resolved through a defined adjudication procedure, not by whichever label happened to be entered first.

## Ground-level photos only

**This guide is written for ground-level, citizen-submitted phone photos — not satellite or aerial imagery.** See [DATA_CARD.md §1.1](DATA_CARD.md#11-ground-level-vs-satellite-imagery--do-not-conflate). If a labeling task ever includes satellite/aerial images, that is a different guide with different visual cues (roof-only visibility, different debris-field interpretation) — do not apply this guide's ground-level heuristics to overhead imagery, and do not mix the two image domains in one labeling pass without recording `image_domain` per item.

## The five classes, in decision order

Work through these in order — stop at the first class that applies. This ordering exists to reduce ambiguity between adjacent classes (e.g. always check "is this destroyed" before agonizing over major vs. minor).

### 1. `unknown`

Assign `unknown` if **any** of the following is true, before considering damage severity at all:
- The image does not show a building/structure at all (e.g., a person, a document, an unrelated scene).
- The structure is visible but the image quality (blur, darkness, extreme distance, obstruction) makes a damage judgment genuinely impossible — not just "hard," but impossible for any careful labeler.
- The image shows only an interior with no way to judge structural (vs. cosmetic/water/mess) damage.

Do not assign `unknown` merely because you personally find the case hard but a careful look would resolve it — see the adjudication procedure below for genuinely hard cases; `unknown` is for images that cannot be resolved, not images that are effortful to resolve.

### 2. `destroyed`

The structure has collapsed entirely, or so little of the original structure remains standing that "repair" is not a meaningful concept — it would be rebuilding, not fixing. Look for: the roofline is at or near ground level; walls are down; what remains is a debris field, not a building with damage.

### 3. `major_damage`

The structure is still recognizably a structure (walls and/or roof largely still standing) but has severe, structural-level damage: partial collapse of a section, a large structural crack, a missing wall, a roof that has caved in over part of the building. The key test: **would a reasonable person consider this structure unsafe to occupy without major repair?** If yes, `major_damage` (unless it's actually `destroyed` per above).

### 4. `minor_damage`

Visible damage that does not rise to "unsafe to occupy" — broken windows, damaged but intact roofing, dented/cracked siding or walls, debris on the property that didn't come from a structural collapse of *this* building. The structure remains basically usable.

### 5. `no_damage`

No visible structural damage. Pre-existing wear, dirt, or age is not damage. If you're unsure whether something is pre-existing wear or new disaster damage and the image gives no way to tell, prefer `unknown` over guessing `no_damage` — a false `no_damage` label is a worse training signal than an honest `unknown` (see [SUCCESS_METRICS.md](../docs/product/SUCCESS_METRICS.md) abstention rationale: an honest "can't tell" beats a confident wrong answer).

## The `minor_damage` / `major_damage` boundary specifically

This is the boundary labelers disagree on most. The test above ("unsafe to occupy without major repair?") is the tiebreaker. When still genuinely unsure after applying it, label your best judgment and let the multi-labeler agreement process (below) catch it — don't spend excessive time on one image trying to force certainty that isn't there.

## Multi-labeler agreement and adjudication

- Every image in a labeling batch should, where labeler capacity allows, be labeled independently by **at least two labelers** before being finalized.
- `ml/src/audit.py`'s `--check-agreement` pass computes exact agreement and a weighted (ordinal-distance-aware, since these classes have a natural severity order) disagreement score per image, and flags any image where labelers disagree by more than one severity step (e.g. one labeler says `minor_damage`, another says `destroyed`) as **requiring adjudication**, never auto-resolved by majority vote or averaging.
- Adjudication is a **third, senior labeler** reviewing the disagreement and the original image, recording a final label plus a one-line reason in the manifest's `adjudication_note` field. Adjudication decisions are logged, not silently overwritten — the original two (disagreeing) labels remain in the manifest alongside the adjudicated final label, so the disagreement itself remains visible for later bias/quality analysis.
- An image with only one labeler assigned (adjudication capacity not available) is still usable but is flagged `single_labeler: true` in the manifest — this is disclosed in [DATA_CARD.md](DATA_CARD.md), not hidden.

## What labelers must never do

- Never infer severity from metadata (report description text, reporter-claimed severity, location) instead of the image itself — the label must reflect only what is visible in the photo, per the model's actual input at inference time.
- Never label an image you cannot see clearly (corrupted, failed to load) — flag it for the corruption-detection pass (`ml/src/prepare_data.py`) instead of guessing.
- Never assign a label to an image containing an identifiable face, a legible identity document, or a deceased person without first following [ETHICS_AND_PRIVACY.md](ETHICS_AND_PRIVACY.md)'s privacy-flag procedure — privacy review happens before or alongside labeling, never after.
