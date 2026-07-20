import type { NextRequest } from "next/server";
import { submitVerificationDecisionSchema } from "@mboyo/domain";
import { createServerSupabaseClient } from "../../../../../lib/supabase/server";
import { requireApiPermission } from "../../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../../lib/api/respond";
import { resolveRequestId } from "../../../../../lib/api/request-id";
import { submitVerificationDecision } from "../../../../../lib/reports/service/transitions";

export const dynamic = "force-dynamic";

/**
 * Submits a Verifier's confirm/override/reject/request_info/escalate/
 * insufficient_evidence decision (the last added in BLOCK 23) — the ONLY
 * endpoint that can move a report's status out of
 * analysis_completed/needs_manual_review. This is deliberately a domain
 * command (POST .../decision with a `decision` field), never a generic
 * PATCH/PUT .../status endpoint — per this block's explicit requirement
 * ("Never expose an arbitrary status-update endpoint. Every state change
 * must use a domain command and validate actor/preconditions"), the
 * caller submits what happened (a verification decision), not what state
 * they want the report to end up in; the resulting status is entirely
 * computed by submit_verification_decision() (BLOCK 16/23's migrations) per
 * docs/product/STATE_MACHINES.md, never accepted as client input.
 *
 * "additional information" is the `request_info` decision value — it keeps
 * the report in needs_manual_review (annotated via the verification_reviews
 * row's notes) rather than introducing a separate table/endpoint, since
 * docs/product/STATE_MACHINES.md models it as one of the six decision
 * outcomes, not a distinct entity. `reject` additionally requires
 * `rejectReasonCategory` (BLOCK 23) — validated by
 * submitVerificationDecisionSchema before this route ever calls the RPC.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ reportId: string }> }) {
  const requestId = resolveRequestId(request);

  try {
    await requireApiPermission("report", "approve");
    const supabase = await createServerSupabaseClient();
    const { reportId } = await params;

    const body: unknown = await request.json().catch(() => null);
    const input = submitVerificationDecisionSchema.parse(body);

    const report = await submitVerificationDecision(supabase, reportId, input);
    return respondOk({ report }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
