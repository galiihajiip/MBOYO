from __future__ import annotations

from pathlib import Path

from data_governance.config import load_dataset_config
from data_governance.manifest import ManifestRow, read_manifest, write_manifest
from split import compute_manifest_hash, group_key, run, split_rows


def make_group_rows(source_id: str, group: str, count: int, prefix: str) -> list[ManifestRow]:
    return [
        ManifestRow(
            image_id=f"{prefix}-{i}",
            source_id=source_id,
            relative_path=f"{prefix}-{i}.jpg",
            geographic_group=group,
            label="minor_damage",
        )
        for i in range(count)
    ]


def test_empty_manifest_exits_zero(dataset_config_path: Path) -> None:
    config = load_dataset_config(dataset_config_path)
    write_manifest([], config.manifests_dir / "deduplicated.csv")

    exit_code = run(config)
    assert exit_code == 0
    assert read_manifest(config.manifests_dir / "split.csv") == []


def test_missing_manifest_exits_zero(dataset_config_path: Path) -> None:
    config = load_dataset_config(dataset_config_path)
    exit_code = run(config)
    assert exit_code == 0


def test_all_rows_in_the_same_group_go_to_the_same_split(dataset_config_path: Path) -> None:
    config = load_dataset_config(dataset_config_path)
    rows = make_group_rows("source-a", "region-1", count=10, prefix="img")

    result = split_rows(rows, config, include_privacy_flagged=False)

    splits_used = {row.split for row in result.rows}
    assert len(splits_used) == 1  # one group => exactly one split, never spread


def test_split_is_deterministic_given_the_same_seed(dataset_config_path: Path) -> None:
    config = load_dataset_config(dataset_config_path)
    rows = []
    for i in range(20):
        rows.extend(make_group_rows(f"source-{i}", f"region-{i}", count=1, prefix=f"g{i}"))

    result_1 = split_rows(rows, config, include_privacy_flagged=False)
    result_2 = split_rows(rows, config, include_privacy_flagged=False)

    assignment_1 = {row.image_id: row.split for row in result_1.rows}
    assignment_2 = {row.image_id: row.split for row in result_2.rows}
    assert assignment_1 == assignment_2


def test_split_respects_configured_ratios_approximately(dataset_config_path: Path) -> None:
    config = load_dataset_config(dataset_config_path)
    rows = []
    for i in range(60):
        rows.extend(make_group_rows(f"source-{i}", f"region-{i}", count=1, prefix=f"g{i}"))

    result = split_rows(rows, config, include_privacy_flagged=False)

    total = sum(result.split_counts.values())
    train_share = result.split_counts["train"] / total
    # 60 independent groups, target 0.7/0.15/0.15 — allow a reasonable
    # tolerance since this is a greedy balancer over a finite, non-uniform
    # group-size set, not an exact partition.
    assert 0.55 <= train_share <= 0.85


def test_privacy_flagged_rows_excluded_by_default(dataset_config_path: Path) -> None:
    config = load_dataset_config(dataset_config_path)
    rows = [
        ManifestRow(
            image_id="a",
            source_id="s",
            relative_path="a.jpg",
            geographic_group="r1",
            privacy_flags="identifiable_face",
        ),
        ManifestRow(image_id="b", source_id="s", relative_path="b.jpg", geographic_group="r2"),
    ]

    result = split_rows(rows, config, include_privacy_flagged=False)

    output_ids = {row.image_id for row in result.rows}
    assert output_ids == {"b"}
    assert result.excluded_privacy_flagged == 1


def test_privacy_flagged_rows_included_with_explicit_opt_in(dataset_config_path: Path) -> None:
    config = load_dataset_config(dataset_config_path)
    rows = [
        ManifestRow(
            image_id="a",
            source_id="s",
            relative_path="a.jpg",
            geographic_group="r1",
            privacy_flags="identifiable_face",
        )
    ]

    result = split_rows(rows, config, include_privacy_flagged=True)
    assert {row.image_id for row in result.rows} == {"a"}


def test_corrupt_rows_excluded_from_split(dataset_config_path: Path) -> None:
    config = load_dataset_config(dataset_config_path)
    rows = [
        ManifestRow(
            image_id="a",
            source_id="s",
            relative_path="a.jpg",
            geographic_group="r1",
            is_corrupt=True,
        )
    ]
    result = split_rows(rows, config, include_privacy_flagged=False)
    assert result.rows == []
    assert result.excluded_corrupt == 1


def test_group_key_uses_placeholder_for_missing_values() -> None:
    row = ManifestRow(image_id="a", source_id="s", relative_path="a.jpg")
    key = group_key(row, ("source_id", "geographic_group"))
    assert key == "s|(none)"


def test_compute_manifest_hash_is_deterministic(tmp_path: Path) -> None:
    path = tmp_path / "manifest.csv"
    path.write_text("a,b\n1,2\n", encoding="utf-8")

    hash_1 = compute_manifest_hash(path)
    hash_2 = compute_manifest_hash(path)
    assert hash_1 == hash_2
    assert len(hash_1) == 64


def test_run_writes_a_reproducibility_report_with_manifest_hash(dataset_config_path: Path) -> None:
    config = load_dataset_config(dataset_config_path)
    rows = make_group_rows("s", "r1", count=5, prefix="img")
    write_manifest(rows, config.manifests_dir / "deduplicated.csv")

    exit_code = run(config)
    assert exit_code == 0

    reports = list(config.reports_dir.glob("split_report_*.json"))
    assert len(reports) == 1

    import json

    report = json.loads(reports[0].read_text(encoding="utf-8"))
    assert "input_manifest_sha256" in report
    assert len(report["input_manifest_sha256"]) == 64
    assert report["random_seed"] == config.split.random_seed
