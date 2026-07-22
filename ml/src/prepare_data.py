"""Data preparation entry point (`pnpm ml:prepare`).

Reads raw imagery from ml/data/raw/<source_id>/, validates each source is
registered in data/manifests/SOURCES.md with a recorded license (per
ETHICS_AND_PRIVACY.md section 1 — an unregistered or license-blank source
is skipped and reported, never silently ingested), detects corrupt/
unreadable files, computes SHA-256 and a perceptual hash per image, and
writes ml/data/manifests/prepared.csv — the manifest every later stage
(deduplicate.py, audit.py, split.py) reads.

Raw data immutability: this script only ever READS from ml/data/raw/ — it
never moves, renames, deletes, or modifies a file there. Corrupt/invalid
files are recorded as such in the manifest (is_corrupt=true) and excluded
from later stages, but the original file is left untouched — a human can
always go back to ml/data/raw/ and see exactly what was originally
provided, per DATA_CARD.md's raw-data-is-immutable principle.

Per AGENTS.md ML honesty rules and this block's explicit requirement: if
ml/data/raw/ is empty (as it is until a real source is added), this script
exits 0, prints that no data was found, and writes a header-only manifest
— never fabricates rows, never treats "no data" as an error condition.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from data_governance.config import (
    DEFAULT_CONFIG_PATH,
    ConfigError,
    DatasetConfig,
    load_dataset_config,
)
from data_governance.imaging import compute_perceptual_hash, compute_sha256, validate_image
from data_governance.manifest import ManifestRow, write_manifest
from data_governance.sources import SourcesError, load_registered_sources

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def discover_source_directories(raw_dir: Path) -> list[Path]:
    """Every immediate subdirectory of raw_dir is treated as one source_id,
    per SOURCES.md's directory-naming convention. Returns an empty list
    (not an error) if raw_dir doesn't exist or has no subdirectories."""
    if not raw_dir.exists():
        return []
    return sorted(path for path in raw_dir.iterdir() if path.is_dir())


def discover_images(source_dir: Path) -> list[Path]:
    return sorted(
        path
        for path in source_dir.rglob("*")
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    )


def prepare_source(
    source_dir: Path,
    hash_size: int,
    default_image_domain: str,
    is_synthetic: bool,
) -> list[ManifestRow]:
    """Processes one source directory into manifest rows."""
    source_id = source_dir.name
    rows: list[ManifestRow] = []

    for image_path in discover_images(source_dir):
        relative_path = image_path.relative_to(source_dir).as_posix()
        image_id = f"{source_id}/{relative_path}"
        file_size_bytes = image_path.stat().st_size
        validation = validate_image(image_path)

        if not validation.is_valid:
            rows.append(
                ManifestRow(
                    image_id=image_id,
                    source_id=source_id,
                    relative_path=relative_path,
                    file_size_bytes=file_size_bytes,
                    is_synthetic=is_synthetic,
                    is_corrupt=True,
                    corrupt_reason=validation.reason,
                )
            )
            continue

        rows.append(
            ManifestRow(
                image_id=image_id,
                source_id=source_id,
                relative_path=relative_path,
                sha256=compute_sha256(image_path),
                perceptual_hash=compute_perceptual_hash(image_path, hash_size),
                width_px=validation.width_px,
                height_px=validation.height_px,
                file_size_bytes=file_size_bytes,
                image_domain=default_image_domain,
                is_synthetic=is_synthetic,
            )
        )

    return rows


def run(config: DatasetConfig, sources_path: Path | None = None) -> int:
    resolved_sources_path = sources_path or (config.manifests_dir / "SOURCES.md")
    manifest_path = config.manifests_dir / "prepared.csv"

    try:
        registered_sources = load_registered_sources(resolved_sources_path)
    except SourcesError as error:
        print(f"ml:prepare — could not read source manifest: {error}", file=sys.stderr)
        return 1

    source_directories = discover_source_directories(config.raw_dir)

    if not source_directories:
        print(f"ml:prepare — no source directories found under {config.raw_dir}.")
        print("ml:prepare — nothing to prepare.")
        write_manifest([], manifest_path)
        print(f"ml:prepare — wrote header-only manifest to {manifest_path}")
        return 0

    all_rows: list[ManifestRow] = []
    excluded_unregistered: list[str] = []

    for source_dir in source_directories:
        source_id = source_dir.name
        registration = registered_sources.get(source_id)
        license_value = registration.license.strip().lower() if registration else ""
        unlicensed = registration is None or not license_value or license_value == "unclear"

        if config.licensing.require_recorded_license and unlicensed:
            excluded_unregistered.append(source_id)
            continue

        assert registration is not None  # unlicensed check above guarantees this when not excluded
        rows = prepare_source(
            source_dir,
            config.deduplicate.perceptual_hash_size,
            registration.image_domain,
            registration.is_synthetic,
        )
        all_rows.extend(rows)

    write_manifest(all_rows, manifest_path)

    valid_count = sum(1 for row in all_rows if not row.is_corrupt)
    corrupt_count = sum(1 for row in all_rows if row.is_corrupt)
    plural = "y" if len(source_directories) == 1 else "ies"

    print(f"ml:prepare — scanned {len(source_directories)} source director{plural}.")
    if excluded_unregistered:
        print(
            "ml:prepare — excluded unregistered/unlicensed source(s) "
            "(see data/manifests/SOURCES.md): " + ", ".join(excluded_unregistered)
        )
    print(f"ml:prepare — {valid_count} valid image(s), {corrupt_count} corrupt/unreadable.")
    print(f"ml:prepare — wrote manifest to {manifest_path}")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Prepare raw MBOYO dataset imagery into a manifest."
    )
    parser.add_argument(
        "--config",
        type=Path,
        default=DEFAULT_CONFIG_PATH,
        help="Path to dataset.yaml (defaults to ml/configs/dataset.yaml).",
    )
    args = parser.parse_args()

    try:
        config = load_dataset_config(args.config)
    except ConfigError as error:
        print(f"ml:prepare — configuration error: {error}", file=sys.stderr)
        sys.exit(1)

    sys.exit(run(config))


if __name__ == "__main__":
    main()
