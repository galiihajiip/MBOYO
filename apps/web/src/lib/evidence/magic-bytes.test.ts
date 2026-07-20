import { describe, expect, it } from "vitest";
import { isAllowedMimeType, matchesMagicBytes } from "./magic-bytes";

const JPEG_SIGNATURE = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function bytesOf(values: number[]): Uint8Array {
  return new Uint8Array(values);
}

describe("isAllowedMimeType", () => {
  it("accepts the four bucket-allowed MIME types", () => {
    expect(isAllowedMimeType("image/jpeg")).toBe(true);
    expect(isAllowedMimeType("image/png")).toBe(true);
    expect(isAllowedMimeType("image/webp")).toBe(true);
    expect(isAllowedMimeType("image/heic")).toBe(true);
  });

  it("rejects anything not on the allow-list", () => {
    expect(isAllowedMimeType("image/gif")).toBe(false);
    expect(isAllowedMimeType("application/pdf")).toBe(false);
    expect(isAllowedMimeType("text/html")).toBe(false);
    expect(isAllowedMimeType("")).toBe(false);
  });
});

describe("matchesMagicBytes", () => {
  it("matches a real JPEG signature against image/jpeg", () => {
    expect(matchesMagicBytes(bytesOf(JPEG_SIGNATURE), "image/jpeg")).toBe(true);
  });

  it("matches a real PNG signature against image/png", () => {
    expect(matchesMagicBytes(bytesOf(PNG_SIGNATURE), "image/png")).toBe(true);
  });

  it("matches a real WEBP (RIFF....WEBP) signature against image/webp", () => {
    const webp = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
    expect(matchesMagicBytes(bytesOf(webp), "image/webp")).toBe(true);
  });

  it("matches a real HEIC (ftyp heic brand) signature against image/heic", () => {
    // bytes 0-3: box size (arbitrary), 4-7: "ftyp", 8-11: major brand "heic"
    const heic = [0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63];
    expect(matchesMagicBytes(bytesOf(heic), "image/heic")).toBe(true);
  });

  it("rejects a PNG signature claimed as image/jpeg — the core content-sniffing defense", () => {
    expect(matchesMagicBytes(bytesOf(PNG_SIGNATURE), "image/jpeg")).toBe(false);
  });

  it("rejects a JPEG signature claimed as image/png", () => {
    expect(matchesMagicBytes(bytesOf(JPEG_SIGNATURE), "image/png")).toBe(false);
  });

  it("rejects an empty/too-short buffer for every claimed type", () => {
    expect(matchesMagicBytes(bytesOf([]), "image/jpeg")).toBe(false);
    expect(matchesMagicBytes(bytesOf([0xff]), "image/png")).toBe(false);
  });

  it("rejects arbitrary non-image bytes (e.g. a script disguised with a fake extension)", () => {
    const scriptBytes = new TextEncoder().encode("#!/bin/sh\necho pwned\n");
    expect(matchesMagicBytes(scriptBytes, "image/jpeg")).toBe(false);
    expect(matchesMagicBytes(scriptBytes, "image/png")).toBe(false);
    expect(matchesMagicBytes(scriptBytes, "image/webp")).toBe(false);
    expect(matchesMagicBytes(scriptBytes, "image/heic")).toBe(false);
  });
});
