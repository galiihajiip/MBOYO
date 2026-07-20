import { describe, expect, it } from "vitest";
import { validateUploadFilePresence, validateMagicBytes } from "./validate-upload";

function makeFile(bytes: number[], type: string, name = "photo.jpg"): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("validateUploadFilePresence", () => {
  it("throws EvidenceError('missing_file') when file is null", () => {
    expect(() => validateUploadFilePresence(null)).toThrowError(
      expect.objectContaining({ code: "missing_file" }),
    );
  });

  it("throws EvidenceError('mime_not_allowed') for a disallowed MIME type", () => {
    const file = makeFile([0xff, 0xd8, 0xff], "application/pdf", "evidence.pdf");
    expect(() => validateUploadFilePresence(file)).toThrowError(
      expect.objectContaining({ code: "mime_not_allowed" }),
    );
  });

  it("throws EvidenceError('file_too_large') when the file exceeds the 25MB ceiling", () => {
    const oversized = new File([new Uint8Array(26 * 1024 * 1024)], "big.jpg", { type: "image/jpeg" });
    expect(() => validateUploadFilePresence(oversized)).toThrowError(
      expect.objectContaining({ code: "file_too_large" }),
    );
  });

  it("returns the mime type for a valid, allowed, correctly-sized file", () => {
    const file = makeFile([0xff, 0xd8, 0xff], "image/jpeg");
    expect(validateUploadFilePresence(file)).toBe("image/jpeg");
  });
});

describe("validateMagicBytes", () => {
  it("throws EvidenceError('magic_bytes_mismatch') when content doesn't match the claimed MIME type", () => {
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(() => validateMagicBytes(pngBytes, "image/jpeg")).toThrowError(
      expect.objectContaining({ code: "magic_bytes_mismatch" }),
    );
  });

  it("does not throw when content matches the claimed MIME type", () => {
    const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    expect(() => validateMagicBytes(jpegBytes, "image/jpeg")).not.toThrow();
  });
});
