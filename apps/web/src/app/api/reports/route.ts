import type { NextRequest } from "next/server";
import { createReportSchema, reportListFiltersSchema, paginationRequestSchema } from "@mboyo/domain";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { requireApiPermission } from "../../../lib/api/authorize";
import { respondOk, respondError } from "../../../lib/api/respond";
import { resolveRequestId } from "../../../lib/api/request-id";
import { checkRateLimit } from "../../../lib/api/rate-limit";
import { ApiError } from "../../../lib/api/errors";
import { createReport } from "../../../lib/reports/service/create";
import { listReports } from "../../../lib/reports/service/list";

export const dynamic = "force-dynamic";

/**
 * Report submission endpoint — the sync target for the offline queue
 * (docs/architecture/SEQUENCE_FLOWS.md Diagram 3) and this block's "create
 * report" domain service, exposed over HTTP. Idempotent on
 * (reporter_profile_id, client_report_id): see
 * lib/reports/service/create.ts's createReport() for the upsert mechanics
 * that make Background Sync retries safe.
 *
 * Response shape is the shared ApiResult<T> envelope (docs/api/REPORTS_API.md)
 * — lib/offline/sync-replay.ts (the offline queue's replay logic) reads
 * this exact shape, so a change here must stay in lockstep with that file.
 */
export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request);

  try {
    const actor = await requireApiPermission("report", "create");

    // Report submission is a Reporter-initiated write that can be replayed
    // by the offline sync queue — rate-limited per profile (not IP) so one
    // Reporter's burst never affects another, and so this survives shared
    // NAT/campus networks common during a disaster response scenario.
    const rateLimit = checkRateLimit({ key: "report:create", limit: 30, windowMs: 60_000 }, actor.profileId);
    if (!rateLimit.allowed) {
      throw new ApiError("rate_limited", "Terlalu banyak laporan dikirim. Coba lagi sebentar lagi.");
    }

    const supabase = await createServerSupabaseClient();

    const body: unknown = await request.json().catch(() => null);
    const input = createReportSchema.parse(body);

    const report = await createReport(supabase, actor.profileId, input);
    return respondOk({ report }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}

/**
 * Reporter's own report list — "own report list" domain service. RLS
 * (reports_reporter_select_own, BLOCK 08) is the sole authorization
 * boundary for "own" here: this route applies no reporter_profile_id
 * filter itself, since a Reporter's RLS-scoped client can only ever see
 * rows it owns regardless of what this query asks for.
 */
export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request);

  try {
    await requireApiPermission("report", "read");
    const supabase = await createServerSupabaseClient();

    const url = request.nextUrl;
    const filters = reportListFiltersSchema.parse({
      status: url.searchParams.get("status") ?? undefined,
      eventId: url.searchParams.get("eventId") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
    });
    const pagination = paginationRequestSchema.parse({
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
    });

    const result = await listReports(supabase, filters, pagination);
    return respondOk(result, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
