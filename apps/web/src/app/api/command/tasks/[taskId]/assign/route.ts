import type { NextRequest } from "next/server";
import { assignResponseTaskSchema } from "@mboyo/domain";
import { createServerSupabaseClient } from "../../../../../../lib/supabase/server";
import { requireApiPermission } from "../../../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../../../lib/api/respond";
import { resolveRequestId } from "../../../../../../lib/api/request-id";
import { assignResponseTask } from "../../../../../../lib/command/tasks";

export const dynamic = "force-dynamic";

/** Assigns (or reassigns) a task to any profile, any role — Coordinator-only action. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiPermission("response_task", "assign");
    const supabase = await createServerSupabaseClient();
    const { taskId } = await params;
    const body: unknown = await request.json().catch(() => null);
    const input = assignResponseTaskSchema.parse(body);
    const task = await assignResponseTask(supabase, taskId, input);
    return respondOk({ task }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
