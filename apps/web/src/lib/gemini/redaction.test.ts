import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { redactImage } from "./redaction";

async function makeTestJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 120, g: 130, b: 140 } },
  })
    .jpeg()
    .toBuffer();
}

describe("redactImage", () => {
  it("produces a smaller, downscaled derivative of a large image", async () => {
    const original = await makeTestJpeg(1000, 1000);
    const redacted = await redactImage(original);

    const metadata = await sharp(redacted).metadata();
    expect(metadata.width).toBeLessThanOrEqual(256);
    expect(metadata.height).toBeLessThanOrEqual(256);
  });

  it("produces a valid JPEG", async () => {
    const original = await makeTestJpeg(500, 400);
    const redacted = await redactImage(original);
    const metadata = await sharp(redacted).metadata();
    expect(metadata.format).toBe("jpeg");
  });

  it("does not upscale an already-small image beyond its own size", async () => {
    const original = await makeTestJpeg(100, 100);
    const redacted = await redactImage(original);
    const metadata = await sharp(redacted).metadata();
    expect(metadata.width).toBeLessThanOrEqual(256);
    expect(metadata.height).toBeLessThanOrEqual(256);
  });
});
