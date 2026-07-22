import type { NextRequest } from "next/server";
import { recordConsentSchema } from "@mboyo/domain";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { requireApiActor } from "../../../lib/api/authorize";
import { respondOk, respondError } from "../../../lib/api/respond";
import { resolveRequestId } from "../../../lib/api/request-id";
import { getConsentStatus, recordConsent } from "../../../lib/consent/consent";

export const dynamic = "force-dynamic";

/**
 * Consent status/acceptance — deliberately requireApiActor (any
 * authenticated role), not a role-gated permission: every role must accept
 * the same privacy notice, and consent_records_select_own/_insert_own RLS
 * is the actual "own consent only" authorization boundary, same pattern as
 * push-subscriptions/route.ts.
 */
export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request);
  try {
    const actor = await requireApiActor();
    const supabase = await createServerSupabaseClient();
    const statuses = await getConsentStatus(supabase, actor.profileId);
    return respondOk({ statuses }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}

export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiActor();
    const supabase = await createServerSupabaseClient();
    const body: unknown = await request.json().catch(() => null);
    const input = recordConsentSchema.parse(body);
    const record = await recordConsent(supabase, input.documentKey);
    return respondOk({ record }, requestId, 201);
  } catch (error) {
    return respondError(error, requestId);
  }
}
