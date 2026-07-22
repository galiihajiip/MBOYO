"""Config-driven training/benchmark modules for the MBOYO damage-severity
classifier: model factory, losses, metrics, training loop, and the
architecture benchmark harness.

Never imported by apps/web (AGENTS.md architecture boundary) — this
package is only ever invoked from ml/src/train.py, ml/src/evaluate.py, or
the benchmark entry point, all run offline as part of the model
development workflow, never at request-serving time.
"""

from __future__ import annotations
