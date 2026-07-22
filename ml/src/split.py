"""Train/val/test split entry point (`pnpm ml:split`).

Reads a manifest (defaults to ml/data/manifests/deduplicated.csv, or the
output of audit.py if adjudication has been applied — see --input),
assigns each row to train/val/test per configs/dataset.yaml's ratios, and
writes ml/data/manifests/split.csv plus a reproducibility report to
ml/reports/.

Splitting is GROUP-aware, not row-aware: every row sharing the same
(source_id, geographic_group) key is assigned to exactly one split,
together — never spread across splits. This prevents the same disaster
event/location's images (near-identical scenes, shared lighting/
background/damage state) from leaking between train and test, which would
silently inflate a reported metric without the model having learned
anything generalizable. See docs/product/RISK_REGISTER.md risk #5 (Model
Bias) and configs/dataset.yaml's split.group_by comment.

Assignment is deterministic given (group key, random_seed): groups are
sorted by key, then a seeded, reproducible pseudo-random assignment walks
the sorted groups and assigns each to whichever split is currently furthest
below its target fraction (a greedy "largest remaining ratio" balancer) —
the same manifest + the same seed always produces the same split, so a
split can be exactly reproduced/audited later without re-running an
inherently-random process, and the manifest's SHA-256 (recorded in the
report) lets a report be tied to the exact input that produced it.

Excludes privacy-flagged rows from any split by default, per
ETHICS_AND_PRIVACY.md section 3.2 and configs/dataset.yaml's
privacy.exclude_flagged_from_split_by_default — an override requires an
explicit --include-privacy-flagged flag, never a silent default flip.

Empty input exits 0 with a header-only output manifest.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from data_governance.config import (
    DEFAULT_CONFIG_PATH,
    ConfigError,
    DatasetConfig,
    SplitConfig,
    load_dataset_config,
)
from data_governance.manifest import ManifestRow, read_manifest, write_manifest

SPLIT_NAMES = ("train", "val", "test")


@dataclass
class SplitAssignment:
    rows: list[ManifestRow]
    excluded_privacy_flagged: int
    excluded_corrupt: int
    group_count: int
    split_counts: dict[str, int]


def compute_manifest_hash(path: Path) -> str:
    """SHA-256 of the input manifest FILE BYTES (not a semantic hash of its
    rows) — this is the "reproducible hash" this block requires: given the
    exact same input file, split.py's output is provably reproducible,
    and a report can be tied back to precisely the manifest that produced
    it, byte for byte."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def group_key(row: ManifestRow, group_by: tuple[str, ...]) -> str:
    parts = []
    for field_name in group_by:
        value = getattr(row, field_name, "")
        parts.append(str(value) if value else "(none)")
    return "|".join(parts)


def assign_groups_to_splits(group_keys: list[str], split_config: SplitConfig) -> dict[str, str]:
    """Deterministic greedy balancer: sorts group keys for a stable
    iteration order (never relies on dict/set iteration order, which is
    insertion-dependent and not itself a declared contract), then seeds a
    PRNG once and, for each group in a seeded-shuffled order, assigns it to
    whichever split is currently furthest below its target share of
    groups-seen-so-far. This keeps the realized split close to the
    configured ratios even though whole groups (of varying size) are the
    unit of assignment, not individual rows."""
    sorted_keys = sorted(group_keys)
    rng = random.Random(split_config.random_seed)
    shuffled_keys = sorted_keys.copy()
    rng.shuffle(shuffled_keys)

    targets = {"train": split_config.train, "val": split_config.val, "test": split_config.test}
    assigned_counts = {"train": 0, "val": 0, "test": 0}
    assignment: dict[str, str] = {}

    for key in shuffled_keys:
        total_assigned = sum(assigned_counts.values())
        if total_assigned == 0:
            chosen = "train"
        else:
            # Pick the split whose current share is furthest BELOW its target.
            deficits = {
                name: targets[name] - (assigned_counts[name] / total_assigned)
                for name in SPLIT_NAMES
            }
            chosen = max(deficits, key=lambda name: deficits[name])
        assignment[key] = chosen
        assigned_counts[chosen] += 1

    return assignment


def split_rows(
    rows: list[ManifestRow], config: DatasetConfig, include_privacy_flagged: bool
) -> SplitAssignment:
    eligible_rows: list[ManifestRow] = []
    excluded_privacy_flagged = 0
    excluded_corrupt = 0

    for row in rows:
        if row.is_corrupt:
            excluded_corrupt += 1
            continue
        if not include_privacy_flagged and row.privacy_flag_list():
            if config.privacy.exclude_flagged_from_split_by_default:
                excluded_privacy_flagged += 1
                continue
        eligible_rows.append(row)

    group_keys = sorted({group_key(row, config.split.group_by) for row in eligible_rows})
    assignment = assign_groups_to_splits(group_keys, config.split)

    output_rows: list[ManifestRow] = []
    split_counts = {name: 0 for name in SPLIT_NAMES}
    for row in eligible_rows:
        key = group_key(row, config.split.group_by)
        split_name = assignment[key]
        split_counts[split_name] += 1
        output_rows.append(ManifestRow(**{**row.__dict__, "split": split_name}))

    return SplitAssignment(
        rows=output_rows,
        excluded_privacy_flagged=excluded_privacy_flagged,
        excluded_corrupt=excluded_corrupt,
        group_count=len(group_keys),
        split_counts=split_counts,
    )


def run(
    config: DatasetConfig,
    input_manifest_path: Path | None = None,
    include_privacy_flagged: bool = False,
) -> int:
    manifest_path = input_manifest_path or (config.manifests_dir / "deduplicated.csv")
    output_manifest_path = config.manifests_dir / "split.csv"

    if not manifest_path.exists():
        print(f"ml:split — {manifest_path} does not exist. Nothing to split.")
        write_manifest([], output_manifest_path)
        print(f"ml:split — wrote header-only manifest to {output_manifest_path}")
        return 0

    rows = read_manifest(manifest_path)
    if not rows:
        print(f"ml:split — {manifest_path} has no rows. Nothing to split.")
        write_manifest([], output_manifest_path)
        print(f"ml:split — wrote header-only manifest to {output_manifest_path}")
        return 0

    result = split_rows(rows, config, include_privacy_flagged)
    manifest_hash = compute_manifest_hash(manifest_path)

    write_manifest(result.rows, output_manifest_path)

    report_timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    report_path = config.reports_dir / f"split_report_{report_timestamp}.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report = {
        "dataset_name": config.dataset_name,
        "generated_at": report_timestamp,
        "input_manifest": str(manifest_path),
        "input_manifest_sha256": manifest_hash,
        "random_seed": config.split.random_seed,
        "group_by": list(config.split.group_by),
        "configured_ratios": {
            "train": config.split.train,
            "val": config.split.val,
            "test": config.split.test,
        },
        "group_count": result.group_count,
        "split_counts": result.split_counts,
        "excluded_corrupt": result.excluded_corrupt,
        "excluded_privacy_flagged": result.excluded_privacy_flagged,
    }
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(f"ml:split — {len(rows)} input row(s); {result.group_count} distinct group(s).")
    print(f"ml:split — split counts: {result.split_counts}")
    if result.excluded_privacy_flagged:
        print(f"ml:split — excluded {result.excluded_privacy_flagged} privacy-flagged row(s).")
    if result.excluded_corrupt:
        print(f"ml:split — excluded {result.excluded_corrupt} corrupt row(s).")
    print(f"ml:split — input manifest sha256: {manifest_hash}")
    print(f"ml:split — wrote manifest to {output_manifest_path}")
    print(f"ml:split — wrote report to {report_path}")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Split a deduplicated MBOYO dataset manifest into train/val/test."
    )
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG_PATH)
    parser.add_argument("--input", type=Path, default=None)
    parser.add_argument(
        "--include-privacy-flagged",
        action="store_true",
        help="Include privacy-flagged rows (explicit opt-in — see ETHICS_AND_PRIVACY.md).",
    )
    args = parser.parse_args()

    try:
        config = load_dataset_config(args.config)
    except ConfigError as error:
        print(f"ml:split — configuration error: {error}", file=sys.stderr)
        sys.exit(1)

    sys.exit(run(config, args.input, args.include_privacy_flagged))


if __name__ == "__main__":
    main()
