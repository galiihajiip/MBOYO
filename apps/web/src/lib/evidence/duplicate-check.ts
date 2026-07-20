import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Exact-duplicate detection: checks whether this SHA-256 hash already
 * exists among any OTHER report's evidence. Per this block's acceptance
 * criteria ("duplicate hash creates a warning but is not silently
 * discarded"), a match is informational only — the caller still inserts the
 * new row; this function's result becomes report_evidence.is_duplicate_hash
 * and the boolean returned in the API response, never a rejection.
 *
 * Uses the service-role client (not RLS-scoped) deliberately: the Reporter
 * uploading a photo has no RLS grant to read other reporters' evidence
 * rows, but this check must see across all reports to be meaningful — it
 * returns only a boolean, never the other report's identity or content, so
 * it does not leak cross-reporter data through the response.
 */
export async function checkDuplicateHash(
  serviceRoleClient: SupabaseClient,
  sha256Hash: string,
  excludingReportId: string,
): Promise<boolean> {
  const { data } = await serviceRoleClient
    .from("report_evidence")
    .select("id")
    .eq("sha256_hash", sha256Hash)
    .neq("report_id", excludingReportId)
    .limit(1);

  return (data?.length ?? 0) > 0;
}
