from __future__ import annotations

from pathlib import Path

from data_governance.manifest import ManifestRow, read_manifest, write_manifest


def test_write_then_read_round_trips_all_fields(tmp_path: Path) -> None:
    row = ManifestRow(
        image_id="src/a.jpg",
        source_id="src",
        relative_path="a.jpg",
        sha256="a" * 64,
        perceptual_hash="deadbeef",
        width_px=800,
        height_px=600,
        file_size_bytes=12345,
        image_domain="ground_level",
        geographic_group="region-1",
        is_synthetic=True,
        is_corrupt=False,
        corrupt_reason="",
        label="minor_damage",
        label_2="major_damage",
        adjudicated_label="major_damage",
        adjudication_note="senior reviewer: structural crack visible, siding is secondary",
        single_labeler=False,
        privacy_flags="identifiable_face",
        duplicate_of="",
        near_duplicate_group="",
        split="train",
    )

    path = tmp_path / "manifest.csv"
    write_manifest([row], path)
    rows = read_manifest(path)

    assert len(rows) == 1
    assert rows[0] == row


def test_read_manifest_returns_empty_list_for_missing_file(tmp_path: Path) -> None:
    assert read_manifest(tmp_path / "does-not-exist.csv") == []


def test_write_manifest_with_empty_rows_produces_header_only_file(tmp_path: Path) -> None:
    path = tmp_path / "empty.csv"
    write_manifest([], path)

    assert path.exists()
    content = path.read_text(encoding="utf-8")
    assert "image_id" in content
    assert read_manifest(path) == []


def test_boolean_fields_round_trip_correctly(tmp_path: Path) -> None:
    true_row = ManifestRow(image_id="a", source_id="s", relative_path="a.jpg", is_corrupt=True)
    false_row = ManifestRow(image_id="b", source_id="s", relative_path="b.jpg", is_corrupt=False)

    path = tmp_path / "manifest.csv"
    write_manifest([true_row, false_row], path)
    rows = read_manifest(path)

    assert rows[0].is_corrupt is True
    assert rows[1].is_corrupt is False


def test_privacy_flag_list_splits_semicolon_joined_flags() -> None:
    row = ManifestRow(
        image_id="a",
        source_id="s",
        relative_path="a.jpg",
        privacy_flags="identifiable_face;deceased_person",
    )
    assert row.privacy_flag_list() == ["identifiable_face", "deceased_person"]


def test_privacy_flag_list_empty_for_no_flags() -> None:
    row = ManifestRow(image_id="a", source_id="s", relative_path="a.jpg")
    assert row.privacy_flag_list() == []
