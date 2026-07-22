from __future__ import annotations

from pathlib import Path

import pytest

from data_governance.imaging import (
    compute_perceptual_hash,
    compute_sha256,
    hamming_distance,
    validate_image,
)

from .conftest import make_checkerboard_image, make_solid_image


def test_validate_image_accepts_a_real_image(tmp_path: Path) -> None:
    path = tmp_path / "valid.jpg"
    make_solid_image(path, 200, 150, (10, 20, 30))

    result = validate_image(path)
    assert result.is_valid is True
    assert result.width_px == 200
    assert result.height_px == 150


def test_validate_image_rejects_a_non_image_file(tmp_path: Path) -> None:
    path = tmp_path / "not-an-image.jpg"
    path.write_bytes(b"this is definitely not image data, just text")

    result = validate_image(path)
    assert result.is_valid is False
    assert result.reason != ""


def test_validate_image_rejects_a_truncated_jpeg(tmp_path: Path) -> None:
    valid_path = tmp_path / "valid.jpg"
    make_solid_image(valid_path, 200, 200, (100, 100, 100))
    truncated_bytes = valid_path.read_bytes()[: len(valid_path.read_bytes()) // 4]

    truncated_path = tmp_path / "truncated.jpg"
    truncated_path.write_bytes(truncated_bytes)

    result = validate_image(truncated_path)
    assert result.is_valid is False


def test_compute_sha256_is_deterministic_and_content_sensitive(tmp_path: Path) -> None:
    path_a = tmp_path / "a.jpg"
    path_b = tmp_path / "b.jpg"
    make_solid_image(path_a, 100, 100, (10, 10, 10))
    make_solid_image(path_b, 100, 100, (20, 20, 20))

    hash_a1 = compute_sha256(path_a)
    hash_a2 = compute_sha256(path_a)
    hash_b = compute_sha256(path_b)

    assert hash_a1 == hash_a2
    assert hash_a1 != hash_b
    assert len(hash_a1) == 64


def test_perceptual_hash_identical_for_byte_identical_input(tmp_path: Path) -> None:
    path = tmp_path / "img.jpg"
    make_checkerboard_image(path, size=64, cell=8)

    hash_1 = compute_perceptual_hash(path, hash_size=8)
    hash_2 = compute_perceptual_hash(path, hash_size=8)
    assert hash_1 == hash_2
    assert len(hash_1) == 16  # 8*8 bits / 4 bits-per-hex-char


def test_perceptual_hash_large_distance_for_inverted_checkerboard(tmp_path: Path) -> None:
    path_a = tmp_path / "a.jpg"
    path_b = tmp_path / "b.jpg"
    make_checkerboard_image(path_a, size=64, cell=8, invert=False)
    make_checkerboard_image(path_b, size=64, cell=8, invert=True)

    hash_a = compute_perceptual_hash(path_a, hash_size=8)
    hash_b = compute_perceptual_hash(path_b, hash_size=8)
    assert hamming_distance(hash_a, hash_b) > 20


def test_hamming_distance_zero_for_identical_hashes() -> None:
    assert hamming_distance("abcd1234", "abcd1234") == 0


def test_hamming_distance_raises_on_length_mismatch() -> None:
    with pytest.raises(ValueError, match="length mismatch"):
        hamming_distance("abcd", "abcdef")
