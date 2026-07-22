import type { NextRequest } from "next/server";
import { createPushSubscriptionSchema, deletePushSubscriptionSchema } from "@mboyo/domain";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { requireApiActor } from "../../../lib/api/authorize";
import { respondOk, respondError } from "../../../lib/api/respond";
import { resolveRequestId } from "../../../lib/api/request-id";
import {
  createPushSubscription,
  deletePushSubscription,
  listPushSubscriptions,
} from "../../../lib/notifications/push-subscriptions";

export const dynamic = "force-dynamic";

/**
 * Web Push subscription management — deliberately requireApiActor (any
 * authenticated role), not a role-gated permission: every operational role
 * may register their own push subscription per RBAC_MATRIX.md's
 * push_subscription row (C/D own for Reporter/Verifier/Coordinator; Admin
 * is read-only and never calls this route to manage its own).
 * push_subscriptions_insert_own/_select_own/_delete_own RLS is the actual
 * "own subscription only" authorization boundary.
 */
export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiActor();
    const supabase = await createServerSupabaseClient();
    const subscriptions = await listPushSubscriptions(supabase);
    return respondOk({ subscriptions }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}

export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request);
  try {
    const actor = await requireApiActor();
    const supabase = await createServerSupabaseClient();
    const body: unknown = await request.json().catch(() => null);
    const input = createPushSubscriptionSchema.parse(body);
    const subscription = await createPushSubscription(supabase, actor.profileId, input);
    return respondOk({ subscription }, requestId, 201);
  } catch (error) {
    return respondError(error, requestId);
  }
}

export async function DELETE(request: NextRequest) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiActor();
    const supabase = await createServerSupabaseClient();
    const body: unknown = await request.json().catch(() => null);
    const input = deletePushSubscriptionSchema.parse(body);
    await deletePushSubscription(supabase, input.endpoint);
    return respondOk({ deleted: true }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
