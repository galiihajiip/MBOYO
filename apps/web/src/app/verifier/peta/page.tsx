import type { Metadata } from "next";
import { reportListFiltersSchema, paginationRequestSchema } from "@mboyo/domain";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { listQueueReports } from "../../../lib/reports/service/list";
import { EvidenceMapClient } from "../../../components/verifier/EvidenceMapClient";
import { PetaBuktiFilters } from "../../../components/verifier/PetaBuktiFilters";
import type { EvidenceMapPin } from "../../../components/verifier/EvidenceMap";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Peta Bukti — MBOYO" };

interface SearchParams {
  [key: string]: string | string[] | undefined;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Peta Bukti (BLOCK 23) — a real multi-pin map of incoming evidence
 * locations, replacing the earlier stub. Reuses listQueueReports
 * (verifier_report_queue) for pin data (severity + coordinates), same
 * status narrowing as the Antrean Verifikasi queue. Filters: predicted
 * severity and a "hanya perlu tinjauan manual" (needs_manual_review only)
 * toggle, per docs/product/SCREEN_INVENTORY.md. Map tile/style failure
 * falls back to a message directing to Semua Laporan (EvidenceMap's own
 * fallback), never a hard crash.
 */
export default async function PetaBuktiPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();

  const needsReviewOnly = first(params.needsReviewOnly) === "true";

  const filters = reportListFiltersSchema.parse({
    status: needsReviewOnly ? "needs_manual_review" : undefined,
    predictedSeverity: first(params.predictedSeverity),
  });
  const pagination = paginationRequestSchema.parse({ page: 1, pageSize: 100 });

  const result = await listQueueReports(supabase, filters, pagination, {
    baseStatuses: ["analysis_completed", "needs_manual_review"],
  });

  const pins: EvidenceMapPin[] = result.items
    .filter((report) => report.gpsLongitude !== null && report.gpsLatitude !== null)
    .map((report) => ({
      reportId: report.id,
      longitude: report.gpsLongitude!,
      latitude: report.gpsLatitude!,
      severity: report.topSeverity,
    }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-sans text-2xl font-bold text-on-surface">Peta Bukti</h1>
        <p className="mt-1 font-sans text-sm text-on-surface-variant">
          {pins.length} dari {result.totalCount} laporan memiliki data lokasi.
        </p>
      </div>
      <PetaBuktiFilters />
      <EvidenceMapClient pins={pins} />
    </div>
  );
}
