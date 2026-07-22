import type { NextRequest } from "next/server";
import { createExportJobSchema } from "@mboyo/domain";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { requireApiPermission } from "../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../lib/api/respond";
import { resolveRequestId } from "../../../../lib/api/request-id";
import { createExportJob, listExportJobs } from "../../../../lib/command/exports";

export const dynamic = "force-dynamic";

/** Lists export_jobs visible to the caller (Coordinator: own; Auditor: all). */
export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiPermission("export_job", "read");
    const supabase = await createServerSupabaseClient();
    const jobs = await listExportJobs(supabase);
    return respondOk({ jobs }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}

/** Creates and synchronously generates a CSV/GeoJSON export of verified reports for one disaster event. */
export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request);
  try {
    const actor = await requireApiPermission("export_job", "create");
    const supabase = await createServerSupabaseClient();
    const body: unknown = await request.json().catch(() => null);
    const input = createExportJobSchema.parse(body);
    const job = await createExportJob(supabase, actor.profileId, input);
    return respondOk({ job }, requestId, 201);
  } catch (error) {
    return respondError(error, requestId);
  }
}
