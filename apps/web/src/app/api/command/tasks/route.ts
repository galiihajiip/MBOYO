import type { NextRequest } from "next/server";
import { createResponseTaskSchema, paginationRequestSchema, taskListFiltersSchema } from "@mboyo/domain";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { requireApiPermission } from "../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../lib/api/respond";
import { resolveRequestId } from "../../../../lib/api/request-id";
import { createResponseTask, listResponseTasks } from "../../../../lib/command/tasks";

export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseOptionalBoolean(value: string | null): boolean | undefined {
  if (value === null) return undefined;
  return value === "true";
}

/** Lists response_tasks with the Tugas Respons screen's filters. */
export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiPermission("response_task", "read");
    const supabase = await createServerSupabaseClient();
    const params = request.nextUrl.searchParams;

    const filters = taskListFiltersSchema.parse({
      status: first(params.get("status") ?? undefined),
      priority: first(params.get("priority") ?? undefined),
      category: first(params.get("category") ?? undefined),
      assigneeProfileId: first(params.get("assigneeProfileId") ?? undefined),
      overdueOnly: parseOptionalBoolean(params.get("overdueOnly")),
    });
    const pagination = paginationRequestSchema.parse({
      page: params.get("page") ?? undefined,
      pageSize: params.get("pageSize") ?? undefined,
    });

    const result = await listResponseTasks(supabase, filters, pagination);
    return respondOk(result, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}

/** Creates a draft response_task targeting exactly one report or one incident_cluster. */
export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiPermission("response_task", "create");
    const supabase = await createServerSupabaseClient();
    const body: unknown = await request.json().catch(() => null);
    const input = createResponseTaskSchema.parse(body);
    const task = await createResponseTask(supabase, input);
    return respondOk({ task }, requestId, 201);
  } catch (error) {
    return respondError(error, requestId);
  }
}
