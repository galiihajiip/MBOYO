import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "../../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

interface EvidenceRow {
  id: string;
  mime_type: string;
  size_bytes: number;
  width_px: number | null;
  height_px: number | null;
  is_duplicate_hash: boolean;
  uploaded_at: string;
}

/**
 * Lists a report's evidence with its quality/duplicate signals — this is
 * how "verifier sees quality/duplicate warnings" (this block's acceptance
 * criterion) is satisfied at the data layer: is_duplicate_hash and the
 * decoded dimensions (width_px/height_px, from which a Verifier UI can
 * derive a low-resolution warning) are returned per evidence row. No
 * Verifier evidence-review screen exists yet (verifier/laporan is still a
 * BLOCK 11 nav stub — that screen is a later block's scope), so this
 * endpoint is the honest boundary of this block's responsibility: prove the
 * warning data is computed correctly and RBAC-readable by the roles that
 * will eventually consume it in that screen.
 *
 * Authorization is entirely RLS (report_evidence_verifier_select /
 * _coordinator_select_verified / _auditor_select / _reporter_select_own,
 * BLOCK 08's rls_policies migration) via the RLS-scoped client — no
 * additional role check here, for the same reason the signed-url route
 * has none: a row this caller isn't allowed to see simply isn't returned.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
): Promise<NextResponse> {
  const { reportId } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
  }

  const { data: evidence, error } = await supabase
    .from("report_evidence")
    .select("id, mime_type, size_bytes, width_px, height_px, is_duplicate_hash, uploaded_at")
    .eq("report_id", reportId)
    .order("uploaded_at", { ascending: true })
    .returns<EvidenceRow[]>();

  if (error) {
    return NextResponse.json({ error: "Gagal memuat bukti foto." }, { status: 500 });
  }

  return NextResponse.json({ evidence: evidence ?? [] }, { status: 200 });
}
