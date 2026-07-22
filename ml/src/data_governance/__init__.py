"""Shared data-governance utilities for the MBOYO dataset pipeline.

Used by prepare_data.py, audit.py, split.py, and deduplicate.py so the
manifest schema, config loading, and hashing logic exist in exactly one
place — none of those scripts re-implements its own CSV column order or
its own hashing routine.
"""

from __future__ import annotations
