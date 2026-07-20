import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { processEvidenceImage } from "./process";
import type { EvidenceError } from "./errors";

async function makeJpeg(width: number, height: number, options: { orientation?: number } = {}): Promise<Buffer> {
  let pipeline = sharp({
    create: { width, height, channels: 3, background: { r: 120, g: 40, b: 200 } },
  }).jpeg();

  if (options.orientation) {
    pipeline = pipeline.withExif({ IFD0: { Orientation: String(options.orientation) } });
  }
  return pipeline.toBuffer();
}

describe("processEvidenceImage — decode failures fail safely", () => {
  it("throws EvidenceError('decode_failed') for a non-image buffer", async () => {
    const garbage = Buffer.from("this is not an image, just text pretending to be one");
    await expect(processEvidenceImage(garbage)).rejects.toMatchObject({
      code: "decode_failed",
    } satisfies Partial<EvidenceError>);
  });

  it("throws EvidenceError('decode_failed') for a truncated/corrupt JPEG", async () => {
    const validJpeg = await makeJpeg(400, 400);
    const truncated = validJpeg.subarray(0, Math.floor(validJpeg.length / 4));
    await expect(processEvidenceImage(truncated)).rejects.toMatchObject({ code: "decode_failed" });
  });

  it("throws EvidenceError('resolution_too_low') for an image below the minimum dimension", async () => {
    const tiny = await makeJpeg(50, 50);
    await expect(processEvidenceImage(tiny)).rejects.toMatchObject({ code: "resolution_too_low" });
  });
});

describe("processEvidenceImage — successful pipeline", () => {
  it("returns normalized + thumbnail buffers with correct reported dimensions", async () => {
    const jpeg = await makeJpeg(800, 600);
    const result = await processEvidenceImage(jpeg);

    expect(result.widthPx).toBe(800);
    expect(result.heightPx).toBe(600);
    expect(result.mimeType).toBe("image/jpeg");
    expect(result.normalizedBuffer.byteLength).toBeGreaterThan(0);
    expect(result.thumbnailBuffer.byteLength).toBeGreaterThan(0);
    // Thumbnail must actually be smaller than the normalized original.
    expect(result.thumbnailBuffer.byteLength).toBeLessThan(result.normalizedBuffer.byteLength);
  });

  it("strips EXIF from the normalized output", async () => {
    const withExif = await makeJpeg(400, 400, { orientation: 1 });
    const result = await processEvidenceImage(withExif);

    const outputMeta = await sharp(result.normalizedBuffer).metadata();
    expect(outputMeta.exif).toBeUndefined();
  });

  it("normalizes a rotated (EXIF orientation 6) image so no orientation tag survives", async () => {
    // Orientation 6 = rotate 90deg CW when displayed — sharp's .rotate()
    // (no args) reads this tag, bakes the rotation into pixel data, and
    // the output (with no EXIF at all) has no orientation tag left to
    // misinterpret.
    const rotated = await makeJpeg(800, 600, { orientation: 6 });
    const result = await processEvidenceImage(rotated);

    const outputMeta = await sharp(result.normalizedBuffer).metadata();
    expect(outputMeta.orientation).toBeUndefined();
  });

  it("thumbnail never exceeds the configured max dimension", async () => {
    const jpeg = await makeJpeg(2000, 1000);
    const result = await processEvidenceImage(jpeg);

    const thumbMeta = await sharp(result.thumbnailBuffer).metadata();
    expect(thumbMeta.width).toBeLessThanOrEqual(320);
    expect(thumbMeta.height).toBeLessThanOrEqual(320);
  });
});
