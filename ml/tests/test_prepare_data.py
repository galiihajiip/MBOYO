from __future__ import annotations

from pathlib import Path

from data_governance.config import load_dataset_config
from data_governance.manifest import read_manifest
from prepare_data import run

from .conftest import make_solid_image


def test_empty_raw_directory_exits_zero_and_writes_header_only_manifest(
    dataset_config_path: Path, sources_manifest_path: Path
) -> None:
    config = load_dataset_config(dataset_config_path)
    exit_code = run(config, sources_manifest_path)

    assert exit_code == 0
    manifest_path = config.manifests_dir / "prepared.csv"
    assert manifest_path.exists()
    assert read_manifest(manifest_path) == []


def test_processes_a_registered_licensed_source(
    dataset_config_path: Path, sources_manifest_path: Path, tmp_ml_root: Path
) -> None:
    config = load_dataset_config(dataset_config_path)
    make_solid_image(config.raw_dir / "synthetic-test" / "img1.jpg", 200, 200, (50, 60, 70))
    make_solid_image(config.raw_dir / "synthetic-test" / "img2.jpg", 150, 150, (10, 10, 10))

    exit_code = run(config, sources_manifest_path)
    assert exit_code == 0

    rows = read_manifest(config.manifests_dir / "prepared.csv")
    assert len(rows) == 2
    assert all(row.is_synthetic for row in rows)
    assert all(row.source_id == "synthetic-test" for row in rows)
    assert all(row.sha256 for row in rows)
    assert all(row.image_domain == "ground_level" for row in rows)


def test_excludes_unregistered_source_directory(
    dataset_config_path: Path, sources_manifest_path: Path
) -> None:
    config = load_dataset_config(dataset_config_path)
    make_solid_image(config.raw_dir / "totally-unregistered" / "img.jpg", 200, 200, (1, 2, 3))

    exit_code = run(config, sources_manifest_path)
    assert exit_code == 0

    rows = read_manifest(config.manifests_dir / "prepared.csv")
    assert rows == []


def test_excludes_source_with_blank_license(
    dataset_config_path: Path, sources_manifest_path: Path
) -> None:
    config = load_dataset_config(dataset_config_path)
    make_solid_image(config.raw_dir / "unlicensed-source" / "img.jpg", 200, 200, (1, 2, 3))

    exit_code = run(config, sources_manifest_path)
    assert exit_code == 0

    rows = read_manifest(config.manifests_dir / "prepared.csv")
    assert rows == []


def test_detects_a_corrupt_file(dataset_config_path: Path, sources_manifest_path: Path) -> None:
    config = load_dataset_config(dataset_config_path)
    corrupt_path = config.raw_dir / "synthetic-test" / "corrupt.jpg"
    corrupt_path.parent.mkdir(parents=True, exist_ok=True)
    corrupt_path.write_bytes(b"not a real image")

    exit_code = run(config, sources_manifest_path)
    assert exit_code == 0

    rows = read_manifest(config.manifests_dir / "prepared.csv")
    assert len(rows) == 1
    assert rows[0].is_corrupt is True
    assert rows[0].corrupt_reason != ""


def test_raw_data_files_are_never_modified(
    dataset_config_path: Path, sources_manifest_path: Path
) -> None:
    config = load_dataset_config(dataset_config_path)
    image_path = config.raw_dir / "synthetic-test" / "img.jpg"
    make_solid_image(image_path, 200, 200, (5, 5, 5))
    original_bytes = image_path.read_bytes()

    run(config, sources_manifest_path)

    assert image_path.read_bytes() == original_bytes
