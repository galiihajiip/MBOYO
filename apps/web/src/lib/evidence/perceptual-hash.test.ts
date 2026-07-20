import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { computePerceptualHash } from "./perceptual-hash";

async function makeSolidJpeg(r: number, g: number, b: number): Promise<Buffer> {
  return sharp({ create: { width: 100, height: 100, channels: 3, background: { r, g, b } } }).jpeg().toBuffer();
}

/**
 * A flat/uniform image has no internal contrast, so aHash's "pixel >= mean"
 * comparison is degenerate (every pixel equals the mean) — every flat image
 * hashes to the same all-1s bit pattern regardless of its actual color.
 * This is correct aHash behavior, not a bug, but it means solid-color test
 * fixtures can't be used to test "different images produce different
 * hashes" — need real internal variation (a gradient/checkerboard) instead.
 */
async function makeCheckerboardJpeg(invert = false): Promise<Buffer> {
  const size = 100;
  const cell = 12;
  const channels = 3;
  const pixels = Buffer.alloc(size * size * channels);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const isLight = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0;
      const on = invert ? !isLight : isLight;
      const value = on ? 235 : 15;
      const idx = (y * size + x) * channels;
      pixels[idx] = value;
      pixels[idx + 1] = value;
      pixels[idx + 2] = value;
    }
  }
  return sharp(pixels, { raw: { width: size, height: size, channels } }).jpeg().toBuffer();
}

function hammingDistance(hexA: string, hexB: string): number {
  let distance = 0;
  for (let i = 0; i < hexA.length; i++) {
    const bitsA = parseInt(hexA[i] ?? "0", 16);
    const bitsB = parseInt(hexB[i] ?? "0", 16);
    let xor = bitsA ^ bitsB;
    while (xor > 0) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}

describe("computePerceptualHash", () => {
  it("returns a 16-character hex string (64-bit hash), matching report_evidence.perceptual_hash's expected shape", async () => {
    const jpeg = await makeSolidJpeg(200, 50, 50);
    const hash = await computePerceptualHash(jpeg);

    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("produces an identical hash for byte-identical input", async () => {
    const jpeg = await makeSolidJpeg(10, 80, 220);
    const [hashA, hashB] = await Promise.all([computePerceptualHash(jpeg), computePerceptualHash(jpeg)]);

    expect(hashA).toBe(hashB);
  });

  it("produces a small Hamming distance for near-identical images (re-encoded at a different JPEG quality)", async () => {
    const original = await makeCheckerboardJpeg();
    const recompressed = await sharp(original).jpeg({ quality: 60 }).toBuffer();

    const [hashA, hashB] = await Promise.all([computePerceptualHash(original), computePerceptualHash(recompressed)]);
    // Re-encoding at a different quality introduces minor compression noise
    // but shouldn't flip more than a handful of the 64 downscaled-mean bits.
    expect(hammingDistance(hashA, hashB)).toBeLessThanOrEqual(4);
  });

  it("produces a large Hamming distance for visually distinct images (checkerboard vs. its inverse)", async () => {
    const checkerboard = await makeCheckerboardJpeg();
    const inverted = await makeCheckerboardJpeg(true);

    const [hashA, hashB] = await Promise.all([computePerceptualHash(checkerboard), computePerceptualHash(inverted)]);
    expect(hammingDistance(hashA, hashB)).toBeGreaterThan(20);
  });
});
