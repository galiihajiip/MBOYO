import "server-only";
import type { EvidenceErrorCode } from "@mboyo/domain";

/**
 * Thrown by every stage of the evidence upload pipeline
 * (lib/evidence/validate.ts, lib/evidence/process.ts, and the route handler
 * itself) so the route has one place to translate a failure into an HTTP
 * status + structured error code, rather than each stage inventing its own
 * response shape. `httpStatus` is the stage's own judgment of the right
 * status code; the route trusts it rather than re-deriving it from `code`.
 */
export class EvidenceError extends Error {
  readonly code: EvidenceErrorCode;
  readonly httpStatus: number;

  constructor(code: EvidenceErrorCode, message: string, httpStatus: number) {
    super(message);
    this.name = "EvidenceError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/** Bahasa Indonesia, user-facing message per error code — never leaks internals. */
export const EVIDENCE_ERROR_MESSAGES: Record<EvidenceErrorCode, string> = {
  unauthenticated: "Sesi tidak valid. Silakan masuk kembali.",
  report_not_found: "Laporan tidak ditemukan.",
  report_not_owned: "Laporan ini bukan milik Anda.",
  event_not_found: "Kejadian bencana terkait tidak ditemukan.",
  event_not_active: "Kejadian bencana ini sudah tidak aktif.",
  missing_file: "Berkas foto tidak ditemukan pada permintaan.",
  mime_not_allowed: "Jenis berkas tidak didukung. Gunakan JPEG, PNG, WEBP, atau HEIC.",
  magic_bytes_mismatch: "Berkas tidak sesuai dengan jenis foto yang diklaim.",
  file_too_large: "Ukuran berkas melebihi batas maksimum (25 MB).",
  resolution_too_low: "Resolusi foto terlalu rendah untuk dianalisis.",
  decode_failed: "Berkas foto rusak atau tidak dapat dibaca.",
  storage_upload_failed: "Gagal menyimpan foto. Silakan coba lagi.",
  metadata_persist_failed: "Gagal menyimpan data foto. Silakan coba lagi.",
  rate_limited: "Terlalu banyak unggahan. Coba lagi sebentar lagi.",
  internal_error: "Terjadi kesalahan pada server. Silakan coba lagi.",
};
