import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "../../../../../../lib/supabase/server";
import { getServerEnv } from "../../../../../../lib/env.server";

export const dynamic = "force-dynamic";

/** Short-lived per docs/security/THREAT_MODEL.md threat #5 (Signed URL Leakage) — minimizes the exposure window if a URL leaks. */
const SIGNED_URL_TTL_SECONDS = 60;

interface EvidenceRow {
  storage_path: string;
  thumbnail_path: string | null;
}

/**
 * Issues a short-lived signed URL for one evidence object (or its
 * thumbnail, via ?variant=thumbnail) — server-generated, never persisted
 * anywhere (not logged, not cached; docs/security/THREAT_MODEL.md threat
 * #5's "signed URLs are never logged in plaintext application logs" and
 * this block's "never persisted" requirement).
 *
 * Uses the RLS-scoped client (not service-role) deliberately: authorization
 * for "can this caller see this evidence" is Postgres RLS itself
 * (report_evidence_verifier_select / _coordinator_select_verified /
 * _auditor_select / _reporter_select_own from BLOCK 08's rls_policies
 * migration, and the matching storage.objects policies from this block) —
 * if the SELECT below returns nothing, the caller was never authorized to
 * see this row, full stop, with no separate role-check to keep in sync.
 * createSignedUrl() is likewise called through this same RLS-scoped client:
 * Supabase Storage evaluates the storage.objects SELECT policy for signed
 * URL issuance exactly as it does for a direct download, so the object-level
 * policies from this block's migration are the single enforcement point
 * for both this endpoint and any other path that might read the bucket.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ evidenceId: string }> },
): Promise<NextResponse> {
  const { evidenceId } = await params;
  const variant = request.nextUrl.searchParams.get("variant") === "thumbnail" ? "thumbnail" : "original";

  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
  }

  const { data: evidence } = await supabase
    .from("report_evidence")
    .select("storage_path, thumbnail_path")
    .eq("id", evidenceId)
    .maybeSingle<EvidenceRow>();

  if (!evidence) {
    // RLS makes "not found" and "not authorized" indistinguishable by
    // design (a row you're not allowed to see is simply absent from the
    // query result) — returning 404 here does not leak whether the
    // evidenceId exists for someone else, which is the correct behavior
    // for an access-controlled resource, not just a convenient one.
    return NextResponse.json({ error: "Bukti foto tidak ditemukan." }, { status: 404 });
  }

  const path = variant === "thumbnail" ? evidence.thumbnail_path : evidence.storage_path;
  if (!path) {
    return NextResponse.json({ error: "Miniatur belum tersedia untuk bukti foto ini." }, { status: 404 });
  }

  const env = getServerEnv();
  const { data: signed, error } = await supabase.storage
    .from(env.SUPABASE_REPORTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !signed) {
    return NextResponse.json({ error: "Gagal membuat tautan bukti foto." }, { status: 500 });
  }

  return NextResponse.json(
    { url: signed.signedUrl, expiresInSeconds: SIGNED_URL_TTL_SECONDS },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
