"""Image-quality degradation transforms for the "robustness to poor image
quality" benchmark criterion — synthetic degradations applied to a copy of
the validation/test set, with macro-F1 recomputed under each and compared
to the clean-image baseline. A large drop is reported, never hidden or
averaged into a single number that would obscure which specific degradation
hurts a given architecture most (per RISK_REGISTER.md risk #4, Poor Image
Quality, being an expected real-world condition for ground-level citizen
photos, not an edge case).

Pure Pillow (no OpenCV) — opencv-python-headless is a listed ml/
dependency, but importing cv2 in this environment currently fails with a
NumPy 2.x ABI incompatibility (a pre-existing environment issue, not
something this block introduces or should silently work around by pinning
NumPy down); every degradation below is achievable with Pillow alone, so
this module has no cv2 dependency regardless of that issue's eventual fix.
"""

from __future__ import annotations

import io
from dataclasses import dataclass

from PIL import Image, ImageEnhance, ImageFilter


@dataclass(frozen=True)
class DegradationSpec:
    name: str
    params: dict[str, float]


def apply_degradation(image: Image.Image, spec: DegradationSpec) -> Image.Image:
    """Applies one named degradation to a PIL Image, returning a new image
    (never mutates the input in place) — matches configs/training.yaml's
    robustness.degradations entries exactly by name."""
    if spec.name == "gaussian_blur":
        kernel_size = spec.params.get("kernel_size", 9)
        # PIL's GaussianBlur takes a radius, not a discrete kernel size —
        # radius = (kernel_size - 1) / 2 is the standard conversion, so this
        # config value means roughly the same blur strength it would under
        # an OpenCV-style kernel-size API, keeping the config human-readable
        # in familiar terms.
        radius = max(0.5, (kernel_size - 1) / 2)
        return image.filter(ImageFilter.GaussianBlur(radius=radius))

    if spec.name == "low_light":
        brightness_factor = spec.params.get("brightness_factor", 0.4)
        return ImageEnhance.Brightness(image).enhance(brightness_factor)

    if spec.name == "jpeg_compression_artifact":
        quality = int(spec.params.get("quality", 30))
        buffer = io.BytesIO()
        image.convert("RGB").save(buffer, format="JPEG", quality=quality)
        buffer.seek(0)
        with Image.open(buffer) as degraded:
            return degraded.convert("RGB").copy()

    if spec.name == "low_resolution":
        # Simulates a citizen photo captured/uploaded at low resolution:
        # downscale then upscale back to the original size (so it still
        # feeds the model's expected input shape), leaving the same
        # information loss a genuinely low-resolution capture would have.
        scale_factor = spec.params.get("scale_factor", 0.25)
        original_size = image.size
        downscaled_size = (
            max(1, int(original_size[0] * scale_factor)),
            max(1, int(original_size[1] * scale_factor)),
        )
        downscaled = image.resize(downscaled_size, Image.Resampling.BILINEAR)
        return downscaled.resize(original_size, Image.Resampling.BILINEAR)

    raise ValueError(f"Unknown degradation '{spec.name}'")
