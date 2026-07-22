"""The manifest row schema shared by every pipeline stage.

A manifest is a CSV file, one row per image, that accumulates columns as
an image moves through the pipeline: prepare_data.py produces the initial
manifest (one row per successfully-validated raw image, with corruption/
dimension/hash columns filled), deduplicate.py adds duplicate-group
columns, audit.py adds label/agreement/privacy columns, split.py adds the
final split assignment. Each stage reads the previous stage's manifest and
writes a new one — manifests are append-only artifacts, never edited in
place, so a specific pipeline run's output is always reproducible from its
inputs.

Plain csv + dataclasses (not pandas) — this project's ml/pyproject.toml
does not depend on pandas, and a manifest is small/simple enough (one row
per image, ~20 columns) that a dependency-free CSV reader/writer is the
right amount of machinery.
"""

from __future__ import annotations

import csv
from dataclasses import asdict, dataclass, fields
from pathlib import Path

# Column order is significant for readability/diffing — a manifest file
# checked into version control (or attached to a report) should have a
# stable, predictable column order across runs, not whatever order a dict
# happened to iterate in.
MANIFEST_FIELD_ORDER = (
    "image_id",
    "source_id",
    "relative_path",
    "sha256",
    "perceptual_hash",
    "width_px",
    "height_px",
    "file_size_bytes",
    "image_domain",
    "geographic_group",
    "is_synthetic",
    "is_corrupt",
    "corrupt_reason",
    "label",
    "label_2",
    "adjudicated_label",
    "adjudication_note",
    "single_labeler",
    "privacy_flags",
    "duplicate_of",
    "near_duplicate_group",
    "split",
)


@dataclass
class ManifestRow:
    """One image's full record as it accumulates through the pipeline stages.

    Every field has an explicit default so a stage that hasn't run yet
    (e.g. split assignment before split.py has executed) leaves that
    column genuinely empty in the CSV rather than a stage inventing a
    placeholder value to fill it."""

    image_id: str
    source_id: str
    relative_path: str
    sha256: str = ""
    perceptual_hash: str = ""
    width_px: int = 0
    height_px: int = 0
    file_size_bytes: int = 0
    image_domain: str = ""
    geographic_group: str = ""
    is_synthetic: bool = False
    is_corrupt: bool = False
    corrupt_reason: str = ""
    label: str = ""
    label_2: str = ""
    adjudicated_label: str = ""
    adjudication_note: str = ""
    single_labeler: bool = False
    # semicolon-joined flag codes, e.g. "identifiable_face;deceased_person"
    privacy_flags: str = ""
    # image_id of the exact-duplicate original, if this row was dropped as a dup
    duplicate_of: str = ""
    # shared group id for perceptually-similar images, never auto-merged
    near_duplicate_group: str = ""
    split: str = ""  # "train" | "val" | "test", set only by split.py

    def privacy_flag_list(self) -> list[str]:
        return [flag for flag in self.privacy_flags.split(";") if flag]


def _row_to_csv_dict(row: ManifestRow) -> dict[str, str]:
    raw = asdict(row)
    csv_dict: dict[str, str] = {}
    for field in fields(ManifestRow):
        value = raw[field.name]
        if isinstance(value, bool):
            csv_dict[field.name] = "true" if value else "false"
        else:
            csv_dict[field.name] = str(value)
    return csv_dict


def _csv_dict_to_row(raw: dict[str, str]) -> ManifestRow:
    def parse_bool(value: str) -> bool:
        return value.strip().lower() == "true"

    return ManifestRow(
        image_id=raw.get("image_id", ""),
        source_id=raw.get("source_id", ""),
        relative_path=raw.get("relative_path", ""),
        sha256=raw.get("sha256", ""),
        perceptual_hash=raw.get("perceptual_hash", ""),
        width_px=int(raw["width_px"]) if raw.get("width_px") else 0,
        height_px=int(raw["height_px"]) if raw.get("height_px") else 0,
        file_size_bytes=int(raw["file_size_bytes"]) if raw.get("file_size_bytes") else 0,
        image_domain=raw.get("image_domain", ""),
        geographic_group=raw.get("geographic_group", ""),
        is_synthetic=parse_bool(raw.get("is_synthetic", "")),
        is_corrupt=parse_bool(raw.get("is_corrupt", "")),
        corrupt_reason=raw.get("corrupt_reason", ""),
        label=raw.get("label", ""),
        label_2=raw.get("label_2", ""),
        adjudicated_label=raw.get("adjudicated_label", ""),
        adjudication_note=raw.get("adjudication_note", ""),
        single_labeler=parse_bool(raw.get("single_labeler", "")),
        privacy_flags=raw.get("privacy_flags", ""),
        duplicate_of=raw.get("duplicate_of", ""),
        near_duplicate_group=raw.get("near_duplicate_group", ""),
        split=raw.get("split", ""),
    )


def write_manifest(rows: list[ManifestRow], path: Path) -> None:
    """Writes rows to `path` as CSV, creating parent directories as needed.
    An empty `rows` list still writes a header-only CSV — see each script's
    own "empty data exits gracefully" handling for why a header-only
    manifest is a valid, non-error output, not something this function
    refuses to produce."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(MANIFEST_FIELD_ORDER))
        writer.writeheader()
        for row in rows:
            writer.writerow(_row_to_csv_dict(row))


def read_manifest(path: Path) -> list[ManifestRow]:
    """Reads a manifest CSV. Returns an empty list (not an error) if the file
    has only a header or does not exist — callers are expected to handle the
    empty-list case explicitly per this block's "empty data must exit
    gracefully" requirement."""
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        return [_csv_dict_to_row(raw) for raw in reader]
