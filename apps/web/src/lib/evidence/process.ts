import "server-only";
import sharp from "sharp";
import { EvidenceError } from "./errors";

/** Below this on either axis, the ML pipeline's own input requirements aren't met. */
const MIN_DIMENSION_PX = 200;
const THUMBNAIL_MAX_DIMENSION_PX = 320;

export interface ProcessedImage {
  /** Re-encoded original: orientation baked in (no EXIF Orientation tag needed), all other EXIF stripped. */
  normalizedBuffer: Buffer;
  thumbnailBuffer: Buffer;
  widthPx: number;
  heightPx: number;
  mimeType: string;
}

/**
 * Decodes, normalizes orientation, strips EXIF, and generates a thumbnail —
 * one pass so the (potentially large) original is only decoded once. Any
 * decode failure (corrupt file, structurally invalid despite matching magic
 * bytes) throws EvidenceError("decode_failed") — this is the authoritative
 * validation step per docs/security/THREAT_MODEL.md threat #7: a crafted
 * file that passes the magic-byte check but is malformed internally is
 * caught here, not persisted.
 *
 * EXIF stripping serves two purposes at once: docs/security/THREAT_MODEL.md
 * threat #7's "re-encoding/normalization... sanitizes malformed structure"
 * mitigation, and removing embedded GPS/device metadata that would
 * otherwise ride along with the photo beyond the location the Reporter
 * explicitly submitted through the wizard's GPS/manual-location step.
 */
export async function processEvidenceImage(inputBuffer: Buffer): Promise<ProcessedImage> {
  let metadata;
  try {
    metadata = await sharp(inputBuffer).metadata();
  } catch {
    throw new EvidenceError("decode_failed", "Berkas foto rusak atau tidak dapat dibaca.", 422);
  }

  const width = metadata.width;
  const height = metadata.height;
  if (!width || !height) {
    throw new EvidenceError("decode_failed", "Berkas foto rusak atau tidak dapat dibaca.", 422);
  }

  if (width < MIN_DIMENSION_PX || height < MIN_DIMENSION_PX) {
    throw new EvidenceError(
      "resolution_too_low",
      `Resolusi foto terlalu rendah (${width}x${height}px, minimum ${MIN_DIMENSION_PX}x${MIN_DIMENSION_PX}px).`,
      422,
    );
  }

  try {
    // .rotate() with no argument reads the EXIF Orientation tag, bakes the
    // rotation into the pixel data, and drops the tag. Neither call below
    // requests withMetadata(), so sharp's default (emit no EXIF/ICC/XMP at
    // all in the output) applies — this is the actual "strip unnecessary
    // EXIF" mechanism: not a targeted GPS-tag removal, but wholesale
    // omission, so no embedded metadata (GPS, device make/model, timestamps)
    // can ride along beyond what the Reporter explicitly submitted through
    // the wizard's own GPS/manual-location and description steps.
    const pipeline = sharp(inputBuffer).rotate();

    const [normalizedBuffer, thumbnailBuffer] = await Promise.all([
      pipeline.clone().jpeg({ quality: 90 }).toBuffer(),
      pipeline
        .clone()
        .resize(THUMBNAIL_MAX_DIMENSION_PX, THUMBNAIL_MAX_DIMENSION_PX, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 70 })
        .toBuffer(),
    ]);

    return {
      normalizedBuffer,
      thumbnailBuffer,
      widthPx: width,
      heightPx: height,
      mimeType: "image/jpeg",
    };
  } catch {
    throw new EvidenceError("decode_failed", "Berkas foto rusak atau tidak dapat dibaca.", 422);
  }
}
