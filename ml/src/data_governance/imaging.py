"""Image validation, hashing, and perceptual-hashing utilities.

Uses only Pillow (already a dependency in ml/pyproject.toml) — no extra
image-hashing library — via the same average-hash (aHash) technique used
server-side in apps/web/src/lib/evidence/perceptual-hash.ts (BLOCK 15),
kept consistent across the two pipelines rather than introducing a second,
different hashing approach for the same underlying idea.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, UnidentifiedImageError


@dataclass(frozen=True)
class ImageValidationResult:
    is_valid: bool
    reason: str
    width_px: int
    height_px: int


def compute_sha256(path: Path) -> str:
    """Streams the file in chunks rather than reading it fully into memory —
    matters once real datasets have thousands of multi-megabyte images."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_image(path: Path) -> ImageValidationResult:
    """Opens and fully decodes the image to detect corruption — a file with
    valid magic bytes but truncated/corrupt pixel data (the same threat
    class as apps/web's evidence-upload pipeline, BLOCK 15 threat #7) is
    caught here via Image.load(), not just Image.open() (which only reads
    the header and would miss a truncated file)."""
    try:
        with Image.open(path) as img:
            img.load()
            width, height = img.size
    except (UnidentifiedImageError, OSError, ValueError) as error:
        return ImageValidationResult(is_valid=False, reason=str(error), width_px=0, height_px=0)

    if width <= 0 or height <= 0:
        return ImageValidationResult(
            is_valid=False,
            reason=f"non-positive dimensions ({width}x{height})",
            width_px=width,
            height_px=height,
        )

    return ImageValidationResult(is_valid=True, reason="", width_px=width, height_px=height)


def compute_perceptual_hash(path: Path, hash_size: int = 8) -> str:
    """Average hash (aHash): downscale to hash_size x hash_size grayscale,
    compare each pixel to the mean, one bit per pixel — returns a hex string
    of length hash_size*hash_size/4. Deliberately simple/explainable (not a
    DCT-based pHash) — sufficient as a near-duplicate CANDIDATE signal for
    human/deduplicate.py review, per this block's "duplicate/near-duplicate
    detection" requirement, never a standalone auto-delete decision."""
    with Image.open(path) as img:
        grayscale = img.convert("L").resize((hash_size, hash_size), Image.Resampling.LANCZOS)
        pixels = list(grayscale.getdata())

    mean = sum(pixels) / len(pixels)
    bits = "".join("1" if pixel >= mean else "0" for pixel in pixels)

    hex_chars = []
    for i in range(0, len(bits), 4):
        nibble = bits[i : i + 4].ljust(4, "0")
        hex_chars.append(format(int(nibble, 2), "x"))
    return "".join(hex_chars)


def hamming_distance(hash_a: str, hash_b: str) -> int:
    """Bit-level Hamming distance between two equal-length hex hash strings."""
    if len(hash_a) != len(hash_b):
        raise ValueError(f"hash length mismatch: {len(hash_a)} vs {len(hash_b)}")
    distance = 0
    for char_a, char_b in zip(hash_a, hash_b, strict=True):
        distance += bin(int(char_a, 16) ^ int(char_b, 16)).count("1")
    return distance
