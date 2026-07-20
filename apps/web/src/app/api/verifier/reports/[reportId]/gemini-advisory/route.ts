import type { NextRequest } from "next/server";
import { requestGeminiAdvisorySchema } from "@mboyo/domain";
import { createServerSupabaseClient } from "../../../../../../lib/supabase/server";
import { requireApiPermission } from "../../../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../../../lib/api/respond";
import { resolveRequestId } from "../../../../../../lib/api/request-id";
import {
  requestGeminiAdvisoryForReport,
  listGeminiAdvisoryRequests,
} from "../../../../../../lib/reports/service/gemini-advisory";

export const dynamic = "force-dynamic";

/**
 * POST — triggers one Gemini advisory call for a report (BLOCK 22).
 * Deliberately a domain command (verb-named path, POST-only), never a
 * generic status/field update, matching the house rule established by
 * .../decision/route.ts. Requesting an advisory NEVER changes
 * reports.status or creates a verification_review — this route's response
 * is purely additive, informational output for the Verifier's own
 * judgment.
 *
 * GET — lists the report's advisory-request history (including
 * failed/rate-limited attempts), so the Verifier detail UI can show what
 * was already tried without re-requesting it.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ reportId: string }> }) {
  const requestId = resolveRequestId(request);

  try {
    await requireApiPermission("gemini_advisory_request", "create");
    const supabase = await createServerSupabaseClient();
    const { reportId } = await params;

    const body: unknown = await request.json().catch(() => null);
    const input = requestGeminiAdvisorySchema.parse(body);

    const advisory = await requestGeminiAdvisoryForReport(supabase, reportId, input, requestId);
    return respondOk({ advisory }, requestId, 201);
  } catch (error) {
    return respondError(error, requestId);
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ reportId: string }> }) {
  const requestId = resolveRequestId(request);

  try {
    await requireApiPermission("gemini_advisory_request", "read");
    const supabase = await createServerSupabaseClient();
    const { reportId } = await params;

    const advisories = await listGeminiAdvisoryRequests(supabase, reportId);
    return respondOk({ advisories }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
