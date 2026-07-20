import "server-only";
import { EvidenceError } from "./errors";
import { isAllowedMimeType, matchesMagicBytes, type AllowedMimeType } from "./magic-bytes";

/** supabase/config.toml storage.buckets.report-evidence.file_size_limit. */
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

/**
 * Cheap, pre-decode validation: file presence, declared MIME type against
 * the bucket's allow-list, and size ceiling — rejects obviously-wrong input
 * before reading the file into memory at all.
 */
export function validateUploadFilePresence(file: File | null): AllowedMimeType {
  if (!file) {
    throw new EvidenceError("missing_file", "Berkas foto tidak ditemukan pada permintaan.", 400);
  }

  if (!isAllowedMimeType(file.type)) {
    throw new EvidenceError(
      "mime_not_allowed",
      "Jenis berkas tidak didukung. Gunakan JPEG, PNG, WEBP, atau HEIC.",
      415,
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new EvidenceError("file_too_large", "Ukuran berkas melebihi batas maksimum (25 MB).", 413);
  }

  return file.type;
}

/**
 * Content-sniffing (not trusting the client-supplied MIME type/extension)
 * per docs/security/THREAT_MODEL.md threat #7 — checks the file's actual
 * leading bytes once it has been read into memory. This is a first, cheap
 * filter; the authoritative check is the sharp decode step downstream
 * (lib/evidence/process.ts), which fails closed on anything with a valid
 * signature but corrupt internal structure.
 */
export function validateMagicBytes(buffer: Buffer, mimeType: AllowedMimeType): void {
  if (!matchesMagicBytes(new Uint8Array(buffer), mimeType)) {
    throw new EvidenceError(
      "magic_bytes_mismatch",
      "Berkas tidak sesuai dengan jenis foto yang diklaim.",
      415,
    );
  }
}
