import type { NextRequest } from "next/server";
import { archiveReportSchema } from "@mboyo/domain";
import { createServerSupabaseClient } from "../../../../../lib/supabase/server";
import { requireApiPermission } from "../../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../../lib/api/respond";
import { resolveRequestId } from "../../../../../lib/api/request-id";
import { archiveReport } from "../../../../../lib/reports/service/transitions";

export const dynamic = "force-dynamic";

/**
 * Archives a verified/rejected report — System Administrator's manual
 * retention-management path (docs/product/RBAC_MATRIX.md: `report:configure`,
 * not `report:approve` — archiving is retention management, never
 * validation). Same domain-command shape as .../decision: the caller
 * cannot supply a target status, only a reason; the resulting `archived`
 * status and precondition enforcement (only from verified/rejected) live
 * entirely in archive_report() (this block's migration).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ reportId: string }> }) {
  const requestId = resolveRequestId(request);

  try {
    await requireApiPermission("report", "configure");
    const supabase = await createServerSupabaseClient();
    const { reportId } = await params;

    const body: unknown = await request.json().catch(() => ({}));
    const input = archiveReportSchema.parse(body ?? {});

    const report = await archiveReport(supabase, reportId, input);
    return respondOk({ report }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
