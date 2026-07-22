"""Parses data/manifests/SOURCES.md's source table into a lookup structure.

This is deliberately a Markdown-table parser (not a separate machine-only
YAML/JSON file) — SOURCES.md is meant to be read and edited by a human
deciding whether a source is licensed appropriately (ETHICS_AND_PRIVACY.md
section 1), and keeping the human-readable document as the single source
of truth (rather than a YAML file the Markdown merely summarizes) means
there is exactly one place that can drift out of sync with itself.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path


class SourcesError(ValueError):
    """Raised when SOURCES.md cannot be found or its table cannot be parsed."""


@dataclass(frozen=True)
class RegisteredSource:
    source_id: str
    description: str
    license: str
    consent_basis: str
    image_domain: str
    geographic_precision: str
    date_added: str
    added_by: str

    @property
    def is_synthetic(self) -> bool:
        return self.source_id.startswith("synthetic-") or "synthetic" in self.consent_basis.lower()


_TABLE_ROW_PATTERN = re.compile(r"^\|(.+)\|\s*$")


def _split_row(line: str) -> list[str]:
    match = _TABLE_ROW_PATTERN.match(line.strip())
    if not match:
        return []
    return [cell.strip() for cell in match.group(1).split("|")]


def load_registered_sources(path: Path) -> dict[str, RegisteredSource]:
    """Parses the "Source table" section of SOURCES.md. Returns an empty dict
    (not an error) if the file exists but has no real rows yet (the
    "_(none yet)_" placeholder row, or any row whose source_id cell is
    empty/a placeholder, is skipped) — this is the expected, honest state
    until a source is actually added."""
    if not path.exists():
        raise SourcesError(f"Source manifest not found at {path}")

    lines = path.read_text(encoding="utf-8").splitlines()

    sources: dict[str, RegisteredSource] = {}
    in_source_table = False
    header_seen = False
    separator_seen = False

    for line in lines:
        if line.strip().startswith("## Source table"):
            in_source_table = True
            header_seen = False
            separator_seen = False
            continue
        if in_source_table and line.strip().startswith("## "):
            # Reached the next section (e.g. "Rejected / excluded sources") — stop.
            break
        if not in_source_table:
            continue

        cells = _split_row(line)
        if not cells:
            continue
        if not header_seen:
            header_seen = True
            continue
        if not separator_seen:
            # The "|---|---|..." separator row immediately after the header.
            separator_seen = True
            continue

        source_id = cells[0].strip("`").strip()
        if not source_id or source_id.startswith("_(") or source_id.startswith("("):
            continue

        source = RegisteredSource(
            source_id=source_id,
            description=cells[1] if len(cells) > 1 else "",
            license=cells[2] if len(cells) > 2 else "",
            consent_basis=cells[3] if len(cells) > 3 else "",
            image_domain=cells[4] if len(cells) > 4 else "",
            geographic_precision=cells[5] if len(cells) > 5 else "",
            date_added=cells[6] if len(cells) > 6 else "",
            added_by=cells[7] if len(cells) > 7 else "",
        )
        sources[source_id] = source

    return sources
