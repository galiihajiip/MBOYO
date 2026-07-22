"""Dataset audit entry point (`pnpm ml:audit`).

Reads ml/data/manifests/deduplicated.csv (or --input) and produces a dated
JSON report in ml/reports/ covering:

  - class distribution (per LABELING_GUIDE.md's five classes, plus
    unlabeled-row count),
  - image dimension distribution (min/max/median width and height, and a
    count of images below the configured quality floor),
  - label agreement (exact + ordinal-distance-aware, since severity classes
    have a natural order) between `label` and `label_2` where both are
    present, per LABELING_GUIDE.md's multi-labeler procedure,
  - an adjudication queue: every row where label/label_2 disagree by more
    than one severity step and no adjudicated_label has been recorded yet
    — written to ml/data/manifests/adjudication_queue.csv so a senior
    labeler has a concrete worklist, per LABELING_GUIDE.md's adjudication
    procedure (never auto-resolved by majority/averaging),
  - privacy-flag summary (counts per flag code, per PRIVACY policy) —
    audit.py does not itself run face/document detection; --privacy-scan
    is reserved for an optional future automated-assist pass (see
    ETHICS_AND_PRIVACY.md section 3.3 — any such pass produces a candidate
    flag for human review, never a final decision, and is intentionally
    NOT implemented as a silent default here).

Never computes or asserts a class distribution/agreement rate from zero
rows — an empty manifest produces an explicit "no data" report section,
never a fabricated 0%/100% figure implying data that isn't there.
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
from datetime import UTC, datetime
from pathlib import Path

from data_governance.config import (
    DEFAULT_CONFIG_PATH,
    ConfigError,
    DatasetConfig,
    load_dataset_config,
)
from data_governance.manifest import ManifestRow, read_manifest, write_manifest

# Ordinal order for disagreement-distance scoring — "unknown" is
# deliberately excluded from the ordinal scale (it isn't a severity level
# to measure distance against; a label/unknown disagreement is always
# treated as maximal, see severity_distance below), matching
# LABELING_GUIDE.md's framing of unknown as "cannot judge," not "zero
# damage."
SEVERITY_ORDER = ("no_damage", "minor_damage", "major_damage", "destroyed")


def severity_distance(label_a: str, label_b: str) -> int | None:
    """Returns the ordinal distance between two severity labels, or None if
    either label isn't a real severity class or if either is "unknown"
    (unknown-vs-anything disagreement is a categorical mismatch, not a
    point on the ordinal scale, so it can't be meaningfully distanced)."""
    if label_a == label_b:
        return 0
    if label_a not in SEVERITY_ORDER or label_b not in SEVERITY_ORDER:
        return None
    return abs(SEVERITY_ORDER.index(label_a) - SEVERITY_ORDER.index(label_b))


def audit_class_distribution(rows: list[ManifestRow], classes: tuple[str, ...]) -> dict[str, int]:
    counts = {cls: 0 for cls in classes}
    unlabeled = 0
    for row in rows:
        if row.is_corrupt:
            continue
        effective_label = row.adjudicated_label or row.label
        if effective_label in counts:
            counts[effective_label] += 1
        elif not effective_label:
            unlabeled += 1
    counts["_unlabeled"] = unlabeled
    return counts


def audit_dimensions(rows: list[ManifestRow], min_width: int, min_height: int) -> dict[str, object]:
    valid_rows = [
        row for row in rows if not row.is_corrupt and row.width_px > 0 and row.height_px > 0
    ]
    if not valid_rows:
        return {"count": 0, "note": "no valid images with recorded dimensions"}

    widths = [row.width_px for row in valid_rows]
    heights = [row.height_px for row in valid_rows]
    below_floor = sum(
        1 for row in valid_rows if row.width_px < min_width or row.height_px < min_height
    )

    return {
        "count": len(valid_rows),
        "width_px": {"min": min(widths), "max": max(widths), "median": statistics.median(widths)},
        "height_px": {
            "min": min(heights),
            "max": max(heights),
            "median": statistics.median(heights),
        },
        "below_quality_floor_count": below_floor,
    }


def audit_label_agreement(rows: list[ManifestRow]) -> dict[str, object]:
    dual_labeled = [row for row in rows if row.label and row.label_2 and not row.is_corrupt]
    if not dual_labeled:
        return {"dual_labeled_count": 0, "note": "no rows with both label and label_2 recorded"}

    exact_matches = sum(1 for row in dual_labeled if row.label == row.label_2)
    distances = [severity_distance(row.label, row.label_2) for row in dual_labeled]
    scoreable_distances = [d for d in distances if d is not None]

    return {
        "dual_labeled_count": len(dual_labeled),
        "exact_agreement_count": exact_matches,
        "exact_agreement_rate": round(exact_matches / len(dual_labeled), 4),
        "mean_ordinal_distance": (
            round(sum(scoreable_distances) / len(scoreable_distances), 4)
            if scoreable_distances
            else None
        ),
        "categorical_mismatch_count": len(distances) - len(scoreable_distances),
    }


def build_adjudication_queue(rows: list[ManifestRow]) -> list[ManifestRow]:
    """A row needs adjudication if it has two labels that disagree by more
    than one severity step (or a categorical unknown-vs-severity mismatch)
    and has not already been adjudicated — per LABELING_GUIDE.md, this
    threshold (not just "any disagreement") is what distinguishes a normal
    minor/major boundary judgment call from a disagreement serious enough
    to need a third reviewer."""
    queue: list[ManifestRow] = []
    for row in rows:
        if row.adjudicated_label or not row.label or not row.label_2 or row.is_corrupt:
            continue
        distance = severity_distance(row.label, row.label_2)
        needs_adjudication = distance is None or distance > 1
        if needs_adjudication:
            queue.append(row)
    return queue


def audit_privacy_flags(rows: list[ManifestRow], known_flags: tuple[str, ...]) -> dict[str, int]:
    counts = {flag: 0 for flag in known_flags}
    unrecognized = 0
    for row in rows:
        for flag in row.privacy_flag_list():
            if flag in counts:
                counts[flag] += 1
            else:
                unrecognized += 1
    counts["_unrecognized_flag_occurrences"] = unrecognized
    return counts


def run(config: DatasetConfig, input_manifest_path: Path | None = None) -> int:
    manifest_path = input_manifest_path or (config.manifests_dir / "deduplicated.csv")
    rows = read_manifest(manifest_path)

    report_timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    report_path = config.reports_dir / f"class_audit_{report_timestamp}.json"
    adjudication_queue_path = config.manifests_dir / "adjudication_queue.csv"

    if not rows:
        print(f"ml:audit — {manifest_path} has no rows. Nothing to audit.")
        report_path.parent.mkdir(parents=True, exist_ok=True)
        empty_report = {
            "dataset_name": config.dataset_name,
            "generated_at": report_timestamp,
            "row_count": 0,
            "note": "no data",
        }
        report_path.write_text(json.dumps(empty_report, indent=2), encoding="utf-8")
        write_manifest([], adjudication_queue_path)
        print(f"ml:audit — wrote empty-dataset report to {report_path}")
        return 0

    class_distribution = audit_class_distribution(rows, config.classes)
    dimensions = audit_dimensions(rows, config.quality.min_width_px, config.quality.min_height_px)
    label_agreement = audit_label_agreement(rows)
    privacy_summary = audit_privacy_flags(rows, config.privacy.flags)
    adjudication_queue = build_adjudication_queue(rows)

    corrupt_count = sum(1 for row in rows if row.is_corrupt)
    single_labeler_count = sum(1 for row in rows if row.single_labeler)
    synthetic_count = sum(1 for row in rows if row.is_synthetic)

    report = {
        "dataset_name": config.dataset_name,
        "generated_at": report_timestamp,
        "input_manifest": str(manifest_path),
        "row_count": len(rows),
        "corrupt_count": corrupt_count,
        "synthetic_count": synthetic_count,
        "single_labeler_count": single_labeler_count,
        "class_distribution": class_distribution,
        "dimensions": dimensions,
        "label_agreement": label_agreement,
        "privacy_flag_counts": privacy_summary,
        "adjudication_queue_size": len(adjudication_queue),
    }

    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    write_manifest(adjudication_queue, adjudication_queue_path)

    print(
        f"ml:audit — {len(rows)} row(s) audited "
        f"({corrupt_count} corrupt, {synthetic_count} synthetic)."
    )
    print(f"ml:audit — class distribution: {class_distribution}")
    print(f"ml:audit — {len(adjudication_queue)} row(s) require adjudication.")
    print(f"ml:audit — wrote report to {report_path}")
    print(f"ml:audit — wrote adjudication queue to {adjudication_queue_path}")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Audit a prepared/deduplicated MBOYO dataset manifest."
    )
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG_PATH)
    parser.add_argument(
        "--input",
        type=Path,
        default=None,
        help="Manifest to audit (defaults to ml/data/manifests/deduplicated.csv).",
    )
    args = parser.parse_args()

    try:
        config = load_dataset_config(args.config)
    except ConfigError as error:
        print(f"ml:audit — configuration error: {error}", file=sys.stderr)
        sys.exit(1)

    sys.exit(run(config, args.input))


if __name__ == "__main__":
    main()
