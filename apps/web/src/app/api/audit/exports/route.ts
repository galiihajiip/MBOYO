import type { NextRequest } from "next/server";
import { createExportJobSchema } from "@mboyo/domain";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { requireApiPermission } from "../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../lib/api/respond";
import { resolveRequestId } from "../../../../lib/api/request-id";
import { createExportJob, listExportJobs } from "../../../../lib/command/exports";

export const dynamic = "force-dynamic";

/** Lists every export_jobs row org-wide — Auditor's compliance-export history read (export_jobs_auditor_all_read RLS). */
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

/** Creates a compliance export — the same real CSV/GeoJSON/JSON generation Coordinator's exports use, per RBAC_MATRIX.md's Auditor "R/E (compliance export)" — export_jobs_auditor_insert RLS scopes this to the Auditor's own requested_by_profile_id. */
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
