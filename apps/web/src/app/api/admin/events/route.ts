import type { NextRequest } from "next/server";
import { createDisasterEventSchema } from "@mboyo/domain";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { requireApiPermission } from "../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../lib/api/respond";
import { resolveRequestId } from "../../../../lib/api/request-id";
import { createDisasterEvent, listDisasterEvents } from "../../../../lib/admin/events";

export const dynamic = "force-dynamic";

/** Lists every disaster_events row — Event Bencana. */
export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiPermission("disaster_event", "read");
    const supabase = await createServerSupabaseClient();
    const events = await listDisasterEvents(supabase);
    return respondOk({ events }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}

/** Creates a disaster_event. */
export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiPermission("disaster_event", "create");
    const supabase = await createServerSupabaseClient();
    const body: unknown = await request.json().catch(() => null);
    const input = createDisasterEventSchema.parse(body);
    const event = await createDisasterEvent(supabase, input);
    return respondOk({ event }, requestId, 201);
  } catch (error) {
    return respondError(error, requestId);
  }
}
