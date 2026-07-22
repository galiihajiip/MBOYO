import { describe, expect, it, vi, afterEach } from "vitest";
import { assessPhotoQuality } from "./photo-quality";

/**
 * assessPhotoQuality is written against browser-only APIs
 * (createImageBitmap/OffscreenCanvas) that don't exist under vitest's node
 * environment — stub both globally per test so each branch of the heuristic
 * (resolution/darkness/blur) can be driven directly via the fake ImageData
 * returned from getImageData, without needing a real image codec.
 */

function stubImageBitmap(width: number, height: number) {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockResolvedValue({ width, height }),
  );
}

function stubCanvas(pixelData: Uint8ClampedArray) {
  const getImageData = vi.fn().mockReturnValue({ data: pixelData });
  const drawImage = vi.fn();
  const ctx = { drawImage, getImageData };

  class FakeOffscreenCanvas {
    width: number;
    height: number;
    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }
    getContext() {
      return ctx;
    }
  }

  vi.stubGlobal("OffscreenCanvas", FakeOffscreenCanvas);
  return { drawImage, getImageData };
}

/** Builds a flat 64x64 RGBA buffer of a single uniform color (no edge energy). */
function flatPixels(r: number, g: number, b: number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(64 * 64 * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
    pixels[i + 3] = 255;
  }
  return pixels;
}

/** Builds a 64x64 RGBA buffer alternating between two luminance extremes, for high edge energy. */
function highContrastCheckerboardPixels(): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(64 * 64 * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    const pixelIndex = i / 4;
    const value = pixelIndex % 2 === 0 ? 255 : 0;
    pixels[i] = value;
    pixels[i + 1] = value;
    pixels[i + 2] = value;
    pixels[i + 3] = 255;
  }
  return pixels;
}

describe("assessPhotoQuality", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when createImageBitmap fails to decode the blob", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("decode failed")));

    const result = await assessPhotoQuality(new Blob());
    expect(result).toBeNull();
  });

  it("returns 'resolusi_rendah' when the image is below the minimum dimension", async () => {
    stubImageBitmap(320, 320);
    stubCanvas(flatPixels(200, 200, 200));

    const result = await assessPhotoQuality(new Blob());
    expect(result).toBe("resolusi_rendah");
  });

  it("returns 'terlalu_gelap' when average luminance is very low", async () => {
    stubImageBitmap(800, 600);
    stubCanvas(flatPixels(5, 5, 5));

    const result = await assessPhotoQuality(new Blob());
    expect(result).toBe("terlalu_gelap");
  });

  it("returns 'kemungkinan_buram' when the image is bright but has near-zero edge energy (flat/blurry)", async () => {
    stubImageBitmap(800, 600);
    stubCanvas(flatPixels(150, 150, 150));

    const result = await assessPhotoQuality(new Blob());
    expect(result).toBe("kemungkinan_buram");
  });

  it("returns null when the image is bright and has high edge energy (sharp, well-lit)", async () => {
    stubImageBitmap(800, 600);
    stubCanvas(highContrastCheckerboardPixels());

    const result = await assessPhotoQuality(new Blob());
    expect(result).toBeNull();
  });

  it("returns null when the canvas 2d context is unavailable", async () => {
    stubImageBitmap(800, 600);
    class FakeOffscreenCanvas {
      getContext() {
        return null;
      }
    }
    vi.stubGlobal("OffscreenCanvas", FakeOffscreenCanvas);

    const result = await assessPhotoQuality(new Blob());
    expect(result).toBeNull();
  });
});
