from __future__ import annotations

from pathlib import Path

from audit import (
    audit_class_distribution,
    audit_dimensions,
    audit_label_agreement,
    audit_privacy_flags,
    build_adjudication_queue,
    run,
    severity_distance,
)
from data_governance.config import load_dataset_config
from data_governance.manifest import ManifestRow, read_manifest, write_manifest

CLASSES = ("no_damage", "minor_damage", "major_damage", "destroyed", "unknown")


def test_severity_distance_zero_for_identical_labels() -> None:
    assert severity_distance("minor_damage", "minor_damage") == 0


def test_severity_distance_measures_ordinal_gap() -> None:
    assert severity_distance("no_damage", "destroyed") == 3
    assert severity_distance("minor_damage", "major_damage") == 1


def test_severity_distance_none_for_unknown_involvement() -> None:
    assert severity_distance("unknown", "minor_damage") is None
    assert severity_distance("no_damage", "unknown") is None


def test_class_distribution_counts_effective_label_preferring_adjudicated() -> None:
    rows = [
        ManifestRow(image_id="a", source_id="s", relative_path="a.jpg", label="minor_damage"),
        ManifestRow(
            image_id="b",
            source_id="s",
            relative_path="b.jpg",
            label="minor_damage",
            label_2="destroyed",
            adjudicated_label="major_damage",
        ),
        ManifestRow(image_id="c", source_id="s", relative_path="c.jpg"),  # unlabeled
    ]
    distribution = audit_class_distribution(rows, CLASSES)

    assert distribution["minor_damage"] == 1
    assert distribution["major_damage"] == 1  # adjudicated label wins over row b's raw label
    assert distribution["_unlabeled"] == 1


def test_class_distribution_excludes_corrupt_rows() -> None:
    rows = [
        ManifestRow(
            image_id="a", source_id="s", relative_path="a.jpg", label="destroyed", is_corrupt=True
        )
    ]
    distribution = audit_class_distribution(rows, CLASSES)
    assert distribution["destroyed"] == 0


def test_audit_dimensions_reports_min_max_median_and_below_floor() -> None:
    rows = [
        ManifestRow(
            image_id="a", source_id="s", relative_path="a.jpg", width_px=100, height_px=100
        ),
        ManifestRow(
            image_id="b", source_id="s", relative_path="b.jpg", width_px=300, height_px=300
        ),
        ManifestRow(image_id="c", source_id="s", relative_path="c.jpg", width_px=20, height_px=20),
    ]
    result = audit_dimensions(rows, min_width=50, min_height=50)

    assert result["count"] == 3
    assert result["below_quality_floor_count"] == 1


def test_audit_dimensions_handles_zero_valid_rows() -> None:
    result = audit_dimensions([], min_width=50, min_height=50)
    assert result["count"] == 0


def test_label_agreement_computes_exact_and_ordinal_stats() -> None:
    rows = [
        ManifestRow(
            image_id="a",
            source_id="s",
            relative_path="a.jpg",
            label="minor_damage",
            label_2="minor_damage",
        ),
        ManifestRow(
            image_id="b",
            source_id="s",
            relative_path="b.jpg",
            label="minor_damage",
            label_2="major_damage",
        ),
    ]
    result = audit_label_agreement(rows)

    assert result["dual_labeled_count"] == 2
    assert result["exact_agreement_count"] == 1
    assert result["exact_agreement_rate"] == 0.5


def test_label_agreement_handles_no_dual_labeled_rows() -> None:
    rows = [ManifestRow(image_id="a", source_id="s", relative_path="a.jpg", label="no_damage")]
    result = audit_label_agreement(rows)
    assert result["dual_labeled_count"] == 0


def test_adjudication_queue_includes_large_disagreements_only() -> None:
    rows = [
        # 1-step disagreement — normal, not queued.
        ManifestRow(
            image_id="a",
            source_id="s",
            relative_path="a.jpg",
            label="minor_damage",
            label_2="major_damage",
        ),
        # 3-step disagreement — must be queued.
        ManifestRow(
            image_id="b",
            source_id="s",
            relative_path="b.jpg",
            label="no_damage",
            label_2="destroyed",
        ),
        # Already adjudicated — must NOT be queued again.
        ManifestRow(
            image_id="c",
            source_id="s",
            relative_path="c.jpg",
            label="no_damage",
            label_2="destroyed",
            adjudicated_label="major_damage",
        ),
    ]
    queue = build_adjudication_queue(rows)
    queued_ids = {row.image_id for row in queue}
    assert queued_ids == {"b"}


def test_privacy_flag_counts() -> None:
    rows = [
        ManifestRow(
            image_id="a", source_id="s", relative_path="a.jpg", privacy_flags="identifiable_face"
        ),
        ManifestRow(
            image_id="b",
            source_id="s",
            relative_path="b.jpg",
            privacy_flags="identifiable_face;deceased_person",
        ),
    ]
    counts = audit_privacy_flags(
        rows, ("identifiable_face", "legible_identity_document", "deceased_person")
    )
    assert counts["identifiable_face"] == 2
    assert counts["deceased_person"] == 1
    assert counts["legible_identity_document"] == 0


def test_run_on_empty_manifest_exits_zero_and_writes_no_data_report(
    dataset_config_path: Path,
) -> None:
    config = load_dataset_config(dataset_config_path)
    write_manifest([], config.manifests_dir / "deduplicated.csv")

    exit_code = run(config)
    assert exit_code == 0

    reports = list(config.reports_dir.glob("class_audit_*.json"))
    assert len(reports) == 1
    assert read_manifest(config.manifests_dir / "adjudication_queue.csv") == []


def test_run_on_populated_manifest_writes_full_report(dataset_config_path: Path) -> None:
    config = load_dataset_config(dataset_config_path)
    rows = [
        ManifestRow(
            image_id="a",
            source_id="s",
            relative_path="a.jpg",
            label="destroyed",
            width_px=400,
            height_px=400,
        ),
        ManifestRow(
            image_id="b",
            source_id="s",
            relative_path="b.jpg",
            label="no_damage",
            label_2="destroyed",
            width_px=400,
            height_px=400,
        ),
    ]
    write_manifest(rows, config.manifests_dir / "deduplicated.csv")

    exit_code = run(config)
    assert exit_code == 0

    queue = read_manifest(config.manifests_dir / "adjudication_queue.csv")
    assert len(queue) == 1
    assert queue[0].image_id == "b"
