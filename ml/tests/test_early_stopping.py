from __future__ import annotations

from training.early_stopping import EarlyStopping


def test_does_not_stop_while_improving() -> None:
    es = EarlyStopping(patience_epochs=2, min_delta=0.01)
    assert es.step(0, 0.5) is False
    assert es.step(1, 0.6) is False
    assert es.step(2, 0.7) is False


def test_stops_after_patience_exhausted() -> None:
    es = EarlyStopping(patience_epochs=2, min_delta=0.01)
    es.step(0, 0.5)
    assert es.step(1, 0.5) is False  # 1st epoch without improvement
    assert es.step(2, 0.5) is True  # 2nd epoch without improvement -> stop


def test_tracks_best_score_and_epoch() -> None:
    es = EarlyStopping(patience_epochs=5, min_delta=0.001)
    es.step(0, 0.5)
    es.step(1, 0.7)
    es.step(2, 0.6)  # regression, but not enough to stop yet
    assert es.best_score == 0.7
    assert es.best_epoch == 1


def test_min_delta_requires_meaningful_improvement() -> None:
    es = EarlyStopping(patience_epochs=1, min_delta=0.1)
    es.step(0, 0.5)
    # Improvement of only 0.05 < min_delta 0.1 -> does not count as improvement.
    assert es.step(1, 0.55) is True
