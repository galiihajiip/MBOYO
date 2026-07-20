import "server-only";

/**
 * Content-sniffing (not trusting the client-supplied MIME type/extension)
 * per docs/security/THREAT_MODEL.md threat #7 ("Malicious Files"). Checks
 * the file's actual leading bytes against the well-known signature for each
 * MIME type this bucket allows (supabase/config.toml
 * storage.buckets.report-evidence.allowed_mime_types). This is a first,
 * cheap filter — the authoritative check is still the sharp decode step
 * downstream (lib/evidence/process.ts), which will fail closed on anything
 * with a valid signature but corrupt internal structure.
 */

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export function isAllowedMimeType(mimeType: string): mimeType is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
}

function bytesStartWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (bytes[offset + i] !== signature[i]) return false;
  }
  return true;
}

/**
 * Returns true if `bytes`' actual signature matches what `claimedMimeType`
 * says it should be. HEIC is a subset of the ISO base media file format
 * (same container as MP4) — its signature lives at a fixed offset (byte 4)
 * as an "ftyp" box with a HEIC-family brand, not at byte 0 like the others.
 */
export function matchesMagicBytes(bytes: Uint8Array, claimedMimeType: AllowedMimeType): boolean {
  switch (claimedMimeType) {
    case "image/jpeg":
      return bytesStartWith(bytes, [0xff, 0xd8, 0xff]);
    case "image/png":
      return bytesStartWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/webp":
      return (
        bytesStartWith(bytes, [0x52, 0x49, 0x46, 0x46]) && // "RIFF"
        bytesStartWith(bytes, [0x57, 0x45, 0x42, 0x50], 8) // "WEBP" at offset 8
      );
    case "image/heic": {
      if (!bytesStartWith(bytes, [0x66, 0x74, 0x79, 0x70], 4)) return false; // "ftyp" at offset 4
      const brand = new TextDecoder("ascii").decode(bytes.slice(8, 12));
      return ["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand);
    }
  }
}
