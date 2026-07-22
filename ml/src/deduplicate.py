"""Duplicate and near-duplicate detection entry point (`pnpm ml:deduplicate`).

Reads ml/data/manifests/prepared.csv (produced by prepare_data.py), finds
exact duplicates (identical SHA-256 — dropped automatically, since a
byte-identical file carries zero additional training signal) and
near-duplicate CANDIDATES (perceptual-hash Hamming distance at or below
the configured threshold — grouped and flagged, never auto-dropped, per
this block's explicit "duplicate/near-duplicate detection" requirement:
detection and reporting, not automatic deletion, since two genuinely
different photos of adjacent buildings in the same damage state can hash
similarly), and writes ml/data/manifests/deduplicated.csv plus a
near-duplicate report to ml/reports/.

Corrupt rows (is_corrupt=true) pass through unchanged — deduplication only
makes sense for images that were successfully decoded in the first place.

Empty input (an empty or missing prepared.csv) exits 0 with a header-only
output manifest, per this block's "empty data must exit gracefully"
requirement.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path

from data_governance.config import (
    DEFAULT_CONFIG_PATH,
    ConfigError,
    DatasetConfig,
    load_dataset_config,
)
from data_governance.imaging import hamming_distance
from data_governance.manifest import ManifestRow, read_manifest, write_manifest


@dataclass(frozen=True)
class DeduplicationResult:
    rows: list[ManifestRow]
    exact_duplicate_count: int
    near_duplicate_groups: list[list[str]]  # each inner list is a group of image_ids


def find_exact_duplicates(rows: list[ManifestRow]) -> tuple[list[ManifestRow], int]:
    """Keeps the first row seen for each distinct sha256 (input order — the
    manifest's own row order, which prepare_data.py writes deterministically
    sorted by source/relative_path); every later row with the same sha256 is
    marked duplicate_of the kept row's image_id rather than removed from the
    manifest entirely — the record that a duplicate existed is itself useful
    provenance, not just noise to discard."""
    seen_by_hash: dict[str, str] = {}
    output_rows: list[ManifestRow] = []
    duplicate_count = 0

    for row in rows:
        if row.is_corrupt or not row.sha256:
            output_rows.append(row)
            continue

        original_id = seen_by_hash.get(row.sha256)
        if original_id is None:
            seen_by_hash[row.sha256] = row.image_id
            output_rows.append(row)
        else:
            duplicate_count += 1
            output_rows.append(
                ManifestRow(
                    **{**row.__dict__, "duplicate_of": original_id},
                )
            )

    return output_rows, duplicate_count


def find_near_duplicate_groups(rows: list[ManifestRow], hamming_threshold: int) -> list[list[str]]:
    """O(n^2) pairwise comparison — acceptable for this pipeline's expected
    scale (a labeling batch, not a web-scale corpus); if the dataset grows
    large enough for this to matter, a locality-sensitive-hashing bucket
    approach would replace this, but that optimization is not worth the
    added complexity before it's actually needed."""
    candidates = [
        row for row in rows if not row.is_corrupt and row.perceptual_hash and not row.duplicate_of
    ]

    groups: list[list[str]] = []
    grouped_ids: set[str] = set()

    for i, row_a in enumerate(candidates):
        if row_a.image_id in grouped_ids:
            continue
        group = [row_a.image_id]
        for row_b in candidates[i + 1 :]:
            if row_b.image_id in grouped_ids:
                continue
            distance = hamming_distance(row_a.perceptual_hash, row_b.perceptual_hash)
            if distance <= hamming_threshold:
                group.append(row_b.image_id)

        if len(group) > 1:
            groups.append(group)
            grouped_ids.update(group)

    return groups


def apply_near_duplicate_groups(
    rows: list[ManifestRow], groups: list[list[str]]
) -> list[ManifestRow]:
    group_id_by_image: dict[str, str] = {}
    for index, group in enumerate(groups):
        group_label = f"near-dup-{index + 1}"
        for image_id in group:
            group_id_by_image[image_id] = group_label

    updated_rows: list[ManifestRow] = []
    for row in rows:
        group_label = group_id_by_image.get(row.image_id, "")
        if group_label:
            updated_row = ManifestRow(**{**row.__dict__, "near_duplicate_group": group_label})
            updated_rows.append(updated_row)
        else:
            updated_rows.append(row)
    return updated_rows


def deduplicate(rows: list[ManifestRow], hamming_threshold: int) -> DeduplicationResult:
    rows_after_exact, exact_duplicate_count = find_exact_duplicates(rows)
    near_duplicate_groups = find_near_duplicate_groups(rows_after_exact, hamming_threshold)
    final_rows = apply_near_duplicate_groups(rows_after_exact, near_duplicate_groups)
    return DeduplicationResult(
        rows=final_rows,
        exact_duplicate_count=exact_duplicate_count,
        near_duplicate_groups=near_duplicate_groups,
    )


def run(config: DatasetConfig, input_manifest_path: Path | None = None) -> int:
    manifest_path = input_manifest_path or (config.manifests_dir / "prepared.csv")
    output_manifest_path = config.manifests_dir / "deduplicated.csv"
    report_path = config.reports_dir / "near_duplicate_report.json"

    rows = read_manifest(manifest_path)

    if not rows:
        print(f"ml:deduplicate — {manifest_path} has no rows. Nothing to deduplicate.")
        write_manifest([], output_manifest_path)
        print(f"ml:deduplicate — wrote header-only manifest to {output_manifest_path}")
        return 0

    result = deduplicate(rows, config.deduplicate.near_duplicate_hamming_threshold)
    write_manifest(result.rows, output_manifest_path)

    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps(
            {
                "input_manifest": str(manifest_path),
                "total_rows": len(rows),
                "exact_duplicate_count": result.exact_duplicate_count,
                "near_duplicate_group_count": len(result.near_duplicate_groups),
                "near_duplicate_groups": result.near_duplicate_groups,
                "hamming_threshold": config.deduplicate.near_duplicate_hamming_threshold,
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"ml:deduplicate — {len(rows)} row(s) processed.")
    print(f"ml:deduplicate — {result.exact_duplicate_count} exact duplicate(s) marked.")
    print(
        f"ml:deduplicate — {len(result.near_duplicate_groups)} near-duplicate group(s) "
        "flagged for review (not auto-removed)."
    )
    print(f"ml:deduplicate — wrote manifest to {output_manifest_path}")
    print(f"ml:deduplicate — wrote report to {report_path}")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Detect exact and near-duplicate images.")
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG_PATH)
    args = parser.parse_args()

    try:
        config = load_dataset_config(args.config)
    except ConfigError as error:
        print(f"ml:deduplicate — configuration error: {error}", file=sys.stderr)
        sys.exit(1)

    sys.exit(run(config))


if __name__ == "__main__":
    main()
