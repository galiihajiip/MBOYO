import type { NextRequest } from "next/server";
import { transitionResponseTaskStatusSchema } from "@mboyo/domain";
import { createServerSupabaseClient } from "../../../../../../lib/supabase/server";
import { requireApiActor } from "../../../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../../../lib/api/respond";
import { resolveRequestId } from "../../../../../../lib/api/request-id";
import { transitionResponseTaskStatus } from "../../../../../../lib/command/tasks";

export const dynamic = "force-dynamic";

/**
 * Advances a task's status. Deliberately requireApiActor (any authenticated
 * user), not requireApiPermission — the assignee driving
 * acknowledged/in_progress/blocked/completed may hold ANY role (this
 * block's user-approved "any profile, any role" assignment decision), so a
 * role-based permission gate would incorrectly block a non-Coordinator
 * assignee from updating their own task. transition_response_task_status()
 * (the RPC) is the actual authorization boundary: it independently checks
 * "is this caller the current assignee" (any transition) or "is this
 * caller a response_coordinator" (cancellation only).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiActor();
    const supabase = await createServerSupabaseClient();
    const { taskId } = await params;
    const body: unknown = await request.json().catch(() => null);
    const input = transitionResponseTaskStatusSchema.parse(body);
    const task = await transitionResponseTaskStatus(supabase, taskId, input);
    return respondOk({ task }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
