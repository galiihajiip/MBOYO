import sharp from "sharp";

/**
 * Produces a "redacted" derivative of an evidence image for the
 * `redacted_image` disclosure level (per this block's "prefer redacted
 * image or derived metadata" requirement) — downscaled to a resolution
 * too coarse for fine identifying detail (faces, license plates,
 * documents) while remaining useful for a coarse scene-level summary,
 * and re-encoded (stripping EXIF/location metadata in the process, since
 * sharp's default output omits input metadata unless explicitly kept).
 *
 * This is a deliberately simple, fast heuristic — not a face-detection or
 * object-aware redaction system — chosen because it requires no
 * additional ML dependency and degrades identifying detail uniformly
 * across the whole image, which is a safe default when nothing is known
 * about where sensitive content might be.
 */
const REDACTED_MAX_DIMENSION_PX = 256;

export async function redactImage(imageBuffer: Buffer): Promise<Buffer> {
  return sharp(imageBuffer)
    .resize(REDACTED_MAX_DIMENSION_PX, REDACTED_MAX_DIMENSION_PX, { fit: "inside" })
    .blur(3)
    .jpeg({ quality: 60 })
    .toBuffer();
}
