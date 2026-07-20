import type { NextRequest } from "next/server";
import { reportListFiltersSchema, paginationRequestSchema } from "@mboyo/domain";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { requireApiRole } from "../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../lib/api/respond";
import { resolveRequestId } from "../../../../lib/api/request-id";
import { listQueueReports } from "../../../../lib/reports/service/list";

export const dynamic = "force-dynamic";

function parseOptionalNumber(value: string | null): number | undefined {
  if (value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalBoolean(value: string | null): boolean | undefined {
  if (value === null || value === "") return undefined;
  return value === "true";
}

/**
 * Verifier's review queue — "Antrean Verifikasi" (BLOCK 23). Narrowed to
 * the two statuses a Verifier actually needs to act on
 * (analysis_completed, needs_manual_review); RLS
 * (reports_verifier_select_all, BLOCK 08) technically lets a Verifier read
 * every status, but this route deliberately doesn't expose that full range
 * as a queue — a Verifier browsing draft_local/syncing rows would be
 * seeing Reporter-side sync mechanics that aren't theirs to act on. This
 * is a UX/API-surface choice, not a security boundary (RLS remains that).
 *
 * Queries listQueueReports (public.verifier_report_queue) rather than
 * listReports so every queue filter docs/product/SCREEN_INVENTORY.md
 * requires — predicted severity, confidence band, quality ceiling,
 * duplicate-candidate flag, GPS accuracy ceiling, report age, escalation
 * flag, "reviewed by me" — is available as a query parameter.
 */
export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request);

  try {
    await requireApiRole("verifier");
    const supabase = await createServerSupabaseClient();

    const url = request.nextUrl;
    const filters = reportListFiltersSchema.parse({
      status: url.searchParams.get("status") ?? undefined,
      eventId: url.searchParams.get("eventId") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      predictedSeverity: url.searchParams.get("predictedSeverity") ?? undefined,
      minConfidence: parseOptionalNumber(url.searchParams.get("minConfidence")),
      maxConfidence: parseOptionalNumber(url.searchParams.get("maxConfidence")),
      maxQualityScore: parseOptionalNumber(url.searchParams.get("maxQualityScore")),
      hasDuplicateCandidate: parseOptionalBoolean(url.searchParams.get("hasDuplicateCandidate")),
      maxGpsAccuracyMeters: parseOptionalNumber(url.searchParams.get("maxGpsAccuracyMeters")),
      minAgeHours: parseOptionalNumber(url.searchParams.get("minAgeHours")),
      escalatedOnly: parseOptionalBoolean(url.searchParams.get("escalatedOnly")),
      reviewedByVerifierProfileId: url.searchParams.get("reviewedByVerifierProfileId") ?? undefined,
    });
    const pagination = paginationRequestSchema.parse({
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
    });

    const result = await listQueueReports(supabase, filters, pagination, {
      baseStatuses: ["analysis_completed", "needs_manual_review"],
    });
    return respondOk(result, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
