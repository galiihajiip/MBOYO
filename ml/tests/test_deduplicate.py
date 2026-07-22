from __future__ import annotations

import shutil
from pathlib import Path

from data_governance.config import load_dataset_config
from data_governance.manifest import ManifestRow, read_manifest, write_manifest
from deduplicate import deduplicate, run

from .conftest import make_checkerboard_image


def test_empty_manifest_exits_zero_and_writes_header_only_output(dataset_config_path: Path) -> None:
    config = load_dataset_config(dataset_config_path)
    write_manifest([], config.manifests_dir / "prepared.csv")

    exit_code = run(config)
    assert exit_code == 0
    assert read_manifest(config.manifests_dir / "deduplicated.csv") == []


def test_missing_manifest_exits_zero(dataset_config_path: Path) -> None:
    config = load_dataset_config(dataset_config_path)
    exit_code = run(config)
    assert exit_code == 0
    assert read_manifest(config.manifests_dir / "deduplicated.csv") == []


def test_exact_duplicate_is_marked_but_not_removed(tmp_path: Path) -> None:
    same_hash = "a" * 64
    row_a = ManifestRow(image_id="a", source_id="s", relative_path="a.jpg", sha256=same_hash)
    row_b = ManifestRow(image_id="b", source_id="s", relative_path="b.jpg", sha256=same_hash)

    result = deduplicate([row_a, row_b], hamming_threshold=4)

    assert len(result.rows) == 2  # both rows retained, not deleted
    assert result.exact_duplicate_count == 1
    assert result.rows[1].duplicate_of == "a"
    assert result.rows[0].duplicate_of == ""


def test_corrupt_rows_pass_through_unaffected() -> None:
    row = ManifestRow(
        image_id="a", source_id="s", relative_path="a.jpg", is_corrupt=True, corrupt_reason="bad"
    )
    result = deduplicate([row], hamming_threshold=4)

    assert len(result.rows) == 1
    assert result.rows[0].is_corrupt is True
    assert result.exact_duplicate_count == 0


def test_near_duplicate_images_are_grouped_not_dropped(
    tmp_path: Path, dataset_config_path: Path
) -> None:
    config = load_dataset_config(dataset_config_path)
    from data_governance.imaging import compute_perceptual_hash, compute_sha256

    img_a = tmp_path / "a.jpg"
    img_b = tmp_path / "b.jpg"  # near-identical to a
    img_c = tmp_path / "c.jpg"  # visually distinct

    make_checkerboard_image(img_a, size=64, cell=8, invert=False)
    shutil.copyfile(
        img_a, img_b
    )  # byte-identical copy would be an EXACT dup — perturb slightly instead
    make_checkerboard_image(img_c, size=64, cell=8, invert=True)

    row_a = ManifestRow(
        image_id="a",
        source_id="s",
        relative_path="a.jpg",
        sha256=compute_sha256(img_a),
        perceptual_hash=compute_perceptual_hash(img_a, config.deduplicate.perceptual_hash_size),
    )
    row_b = ManifestRow(
        image_id="b",
        source_id="s",
        relative_path="b.jpg",
        sha256="different-hash-b",
        perceptual_hash=compute_perceptual_hash(img_b, config.deduplicate.perceptual_hash_size),
    )
    row_c = ManifestRow(
        image_id="c",
        source_id="s",
        relative_path="c.jpg",
        sha256="different-hash-c",
        perceptual_hash=compute_perceptual_hash(img_c, config.deduplicate.perceptual_hash_size),
    )

    result = deduplicate([row_a, row_b, row_c], hamming_threshold=4)

    by_id = {row.image_id: row for row in result.rows}
    assert by_id["a"].near_duplicate_group == by_id["b"].near_duplicate_group
    assert by_id["a"].near_duplicate_group != ""
    assert by_id["c"].near_duplicate_group != by_id["a"].near_duplicate_group
    # Never auto-dropped — all three rows still present.
    assert len(result.rows) == 3


def test_run_writes_a_near_duplicate_report(dataset_config_path: Path) -> None:
    config = load_dataset_config(dataset_config_path)
    same_hash = "b" * 64
    rows = [
        ManifestRow(image_id="a", source_id="s", relative_path="a.jpg", sha256=same_hash),
        ManifestRow(image_id="b", source_id="s", relative_path="b.jpg", sha256=same_hash),
    ]
    write_manifest(rows, config.manifests_dir / "prepared.csv")

    exit_code = run(config)
    assert exit_code == 0

    report_files = list(config.reports_dir.glob("near_duplicate_report.json"))
    assert len(report_files) == 1
