import type { NextRequest } from "next/server";
import { updateDisasterEventSchema } from "@mboyo/domain";
import { createServerSupabaseClient } from "../../../../../lib/supabase/server";
import { requireApiPermission } from "../../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../../lib/api/respond";
import { resolveRequestId } from "../../../../../lib/api/request-id";
import { updateDisasterEvent } from "../../../../../lib/admin/events";

export const dynamic = "force-dynamic";

/** Updates a disaster_event's name/status/geofence/ends_at. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiPermission("disaster_event", "update");
    const supabase = await createServerSupabaseClient();
    const { eventId } = await params;
    const body: unknown = await request.json().catch(() => null);
    const input = updateDisasterEventSchema.parse(body);
    const event = await updateDisasterEvent(supabase, eventId, input);
    return respondOk({ event }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
