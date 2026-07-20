import "server-only";
import { ApiError } from "../../api/errors";
import { getServerEnv } from "../../env.server";
import type { ReportsDbClient } from "./types";

/** Matches the evidence signed-url route's own TTL (BLOCK 15) — kept identical so both call sites share one documented exposure window. */
const SIGNED_URL_TTL_SECONDS = 60;

interface EvidenceRow {
  id: string;
  report_id: string;
  storage_path: string;
  thumbnail_path: string | null;
  mime_type: string;
  size_bytes: number;
  width_px: number | null;
  height_px: number | null;
  is_duplicate_hash: boolean;
  uploaded_at: string;
}

export interface EvidenceDto {
  id: string;
  reportId: string;
  mimeType: string;
  sizeBytes: number;
  widthPx: number | null;
  heightPx: number | null;
  isDuplicateHash: boolean;
  uploadedAt: string;
  /** Short-lived, server-generated for this request only — never persisted or logged, per docs/security/THREAT_MODEL.md threat #5. */
  signedUrl: string;
  thumbnailSignedUrl: string | null;
}

/**
 * Lists a report's evidence rows plus a fresh signed URL for each (image +
 * thumbnail, when present) — the Verifier detail page's private-evidence
 * viewer. Reuses the exact RLS-scoped-client + createSignedUrl() pattern
 * already established by
 * app/api/reports/evidence/[evidenceId]/signed-url/route.ts (BLOCK 15):
 * authorization is entirely RLS on report_evidence/storage.objects, this
 * function applies no role logic of its own. Signed URLs are generated
 * fresh on every call (never cached/persisted) since they expire in
 * SIGNED_URL_TTL_SECONDS.
 */
export async function listReportEvidence(db: ReportsDbClient, reportId: string): Promise<EvidenceDto[]> {
  const { data, error } = await db
    .from("report_evidence")
    .select("id, report_id, storage_path, thumbnail_path, mime_type, size_bytes, width_px, height_px, is_duplicate_hash, uploaded_at")
    .eq("report_id", reportId)
    .order("uploaded_at", { ascending: false })
    .returns<EvidenceRow[]>();

  if (error) {
    throw new ApiError("internal_error", "Gagal memuat bukti foto laporan.");
  }

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const env = getServerEnv();
  const bucket = db.storage.from(env.SUPABASE_REPORTS_BUCKET);

  const results: EvidenceDto[] = [];
  for (const row of rows) {
    const { data: signed } = await bucket.createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);
    const thumbnailSigned = row.thumbnail_path
      ? (await bucket.createSignedUrl(row.thumbnail_path, SIGNED_URL_TTL_SECONDS)).data
      : null;

    if (!signed) {
      // A row that exists but whose object can't be signed (e.g. storage
      // outage) is surfaced by omitting it rather than failing the whole
      // page — the Verifier still sees every other evidence item.
      continue;
    }

    results.push({
      id: row.id,
      reportId: row.report_id,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      widthPx: row.width_px,
      heightPx: row.height_px,
      isDuplicateHash: row.is_duplicate_hash,
      uploadedAt: row.uploaded_at,
      signedUrl: signed.signedUrl,
      thumbnailSignedUrl: thumbnailSigned?.signedUrl ?? null,
    });
  }

  return results;
}
