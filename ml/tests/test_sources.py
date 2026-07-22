from __future__ import annotations

from pathlib import Path

import pytest

from data_governance.sources import SourcesError, load_registered_sources


def test_loads_registered_sources_from_the_real_sources_md() -> None:
    real_path = Path(__file__).resolve().parent.parent / "data" / "manifests" / "SOURCES.md"
    sources = load_registered_sources(real_path)
    # As of this test's writing, the real SOURCES.md has no registered
    # sources yet (only the placeholder row) — this asserts that honest
    # empty state, not a fabricated example entry.
    assert sources == {}


def test_parses_a_populated_source_table(sources_manifest_path: Path) -> None:
    sources = load_registered_sources(sources_manifest_path)

    assert "synthetic-test" in sources
    synthetic = sources["synthetic-test"]
    assert synthetic.license == "CC0"
    assert synthetic.image_domain == "ground_level"
    assert synthetic.is_synthetic is True


def test_source_with_blank_license_is_still_parsed_but_flagged_unlicensed(
    sources_manifest_path: Path,
) -> None:
    sources = load_registered_sources(sources_manifest_path)
    assert "unlicensed-source" in sources
    assert sources["unlicensed-source"].license == ""


def test_raises_for_missing_file(tmp_path: Path) -> None:
    with pytest.raises(SourcesError):
        load_registered_sources(tmp_path / "does-not-exist.md")


def test_placeholder_only_table_yields_no_sources(tmp_path: Path) -> None:
    content = """# Sources

## Source table

| `source_id` | Desc | License | Consent | `image_domain` | Geo | Date | By |
|---|---|---|---|---|---|---|---|
| _(none yet)_ | | | | | | | |
"""
    path = tmp_path / "SOURCES.md"
    path.write_text(content, encoding="utf-8")

    assert load_registered_sources(path) == {}
