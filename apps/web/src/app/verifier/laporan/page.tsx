import type { Metadata } from "next";
import { reportListFiltersSchema, paginationRequestSchema } from "@mboyo/domain";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { listReports } from "../../../lib/reports/service/list";
import { AllReportsList } from "../../../components/verifier/AllReportsList";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Semua Laporan — MBOYO" };

interface SearchParams {
  [key: string]: string | string[] | undefined;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Semua Laporan (BLOCK 23) — full report list across every status, for
 * lookup/reference beyond the active Antrean Verifikasi queue, per
 * docs/product/SCREEN_INVENTORY.md. Unlike the queue, this surface exposes
 * every RLS-visible status a Verifier can read (no baseStatuses narrowing)
 * since its explicit purpose is cross-status lookup, not active triage.
 * No bulk or per-row decision action exists here, per SCREEN_INVENTORY's
 * "no bulk decision actions" — tapping a row only navigates to detail.
 */
export default async function SemuaLaporanPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();

  const filters = reportListFiltersSchema.parse({
    status: first(params.status),
    eventId: first(params.eventId),
    search: first(params.search),
  });
  const pagination = paginationRequestSchema.parse({
    page: first(params.page),
    pageSize: first(params.pageSize),
  });

  const result = await listReports(supabase, filters, pagination);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-sans text-2xl font-bold text-on-surface">Semua Laporan</h1>
        <p className="mt-1 font-sans text-sm text-on-surface-variant">{result.totalCount} laporan ditemukan.</p>
      </div>
      <AllReportsList reports={result.items} />
    </div>
  );
}
