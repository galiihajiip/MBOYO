import type { NextRequest } from "next/server";
import { createServerSupabaseClient } from "../../../../../lib/supabase/server";
import { requireApiPermission } from "../../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../../lib/api/respond";
import { resolveRequestId } from "../../../../../lib/api/request-id";
import { getResponseTaskById, listTaskAssignments } from "../../../../../lib/command/tasks";

export const dynamic = "force-dynamic";

/** Fetches one task plus its full assignment history — the task detail page. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiPermission("response_task", "read");
    const supabase = await createServerSupabaseClient();
    const { taskId } = await params;
    const [task, assignments] = await Promise.all([
      getResponseTaskById(supabase, taskId),
      listTaskAssignments(supabase, taskId),
    ]);
    return respondOk({ task, assignments }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
