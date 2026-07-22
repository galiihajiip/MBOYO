import type { NextRequest } from "next/server";
import { setPrioritySchema } from "@mboyo/domain";
import { createServerSupabaseClient } from "../../../../../../lib/supabase/server";
import { requireApiPermission } from "../../../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../../../lib/api/respond";
import { resolveRequestId } from "../../../../../../lib/api/request-id";
import { setResponseTaskPriority } from "../../../../../../lib/command/tasks";

export const dynamic = "force-dynamic";

/** Sets/changes a task's operational priority — critical requires a reason, always audited. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiPermission("response_task", "update");
    const supabase = await createServerSupabaseClient();
    const { taskId } = await params;
    const body: unknown = await request.json().catch(() => null);
    const input = setPrioritySchema.parse(body);
    const task = await setResponseTaskPriority(supabase, taskId, input);
    return respondOk({ task }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
