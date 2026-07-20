import type { Metadata } from "next";
import { reportListFiltersSchema, paginationRequestSchema } from "@mboyo/domain";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { listQueueReports } from "../../../lib/reports/service/list";
import { QueueFilters } from "../../../components/verifier/QueueFilters";
import { QueueList } from "../../../components/verifier/QueueList";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Antrean Verifikasi — MBOYO" };

interface SearchParams {
  [key: string]: string | string[] | undefined;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Antrean Verifikasi (BLOCK 23) — the real queue, replacing the earlier
 * stub. Filters (severity/confidence/quality/duplicate/GPS-accuracy/age/
 * escalation) live in the URL query string via QueueFilters (client
 * component); this server component reads searchParams directly on every
 * navigation and re-queries listQueueReports, so the URL is always the
 * single source of truth for "what's currently filtered," making the view
 * bookmarkable/shareable and never out of sync with a client-only filter
 * state. No decision action exists here — per SCREEN_INVENTORY.md, tapping
 * a row navigates to the detail/decision screen; this list is view-only.
 */
export default async function AntreanVerifikasiPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();

  const filters = reportListFiltersSchema.parse({
    status: first(params.status),
    eventId: first(params.eventId),
    search: first(params.search),
    predictedSeverity: first(params.predictedSeverity),
    minConfidence: first(params.minConfidence) ? Number(first(params.minConfidence)) : undefined,
    maxConfidence: first(params.maxConfidence) ? Number(first(params.maxConfidence)) : undefined,
    maxQualityScore: first(params.maxQualityScore) ? Number(first(params.maxQualityScore)) : undefined,
    hasDuplicateCandidate: first(params.hasDuplicateCandidate) === "true" ? true : undefined,
    maxGpsAccuracyMeters: first(params.maxGpsAccuracyMeters) ? Number(first(params.maxGpsAccuracyMeters)) : undefined,
    minAgeHours: first(params.minAgeHours) ? Number(first(params.minAgeHours)) : undefined,
    escalatedOnly: first(params.escalatedOnly) === "true" ? true : undefined,
  });
  const pagination = paginationRequestSchema.parse({
    page: first(params.page),
    pageSize: first(params.pageSize),
  });

  const result = await listQueueReports(supabase, filters, pagination, {
    baseStatuses: ["analysis_completed", "needs_manual_review"],
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-sans text-2xl font-bold text-on-surface">Antrean Verifikasi</h1>
        <p className="mt-1 font-sans text-sm text-on-surface-variant">
          {result.totalCount} laporan menunggu tinjauan.
        </p>
      </div>
      <QueueFilters />
      <QueueList reports={result.items} />
    </div>
  );
}
