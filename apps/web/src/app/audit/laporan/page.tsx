import type { Metadata } from "next";
import { paginationRequestSchema, reportListFiltersSchema } from "@mboyo/domain";
import { EmptyState, StatusBadge, reportStatusLabelsInternal } from "@mboyo/ui";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { listReports } from "../../../lib/reports/service/list";
import { DecisionLineagePanel } from "../../../components/audit/DecisionLineagePanel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Laporan Read-Only — MBOYO" };

interface SearchParams {
  [key: string]: string | string[] | undefined;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Laporan Read-Only (BLOCK 26) — replacing the earlier stub. Per RBAC_MATRIX.md
 * "Auditor cannot mutate": zero action affordances anywhere on this
 * screen — the only interactive element is DecisionLineagePanel's own
 * "Lihat Riwayat Keputusan" button, which only ever GETs. Auditor's RLS
 * (reports_auditor_select_all) already grants full cross-status read, so
 * listReports is called with no baseStatuses narrowing (unlike Verifier's
 * queue-scoped call).
 */
export default async function LaporanReadOnlyPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();

  const filters = reportListFiltersSchema.parse({ status: first(params.status) });
  const pagination = paginationRequestSchema.parse({ page: first(params.page), pageSize: first(params.pageSize) });

  const result = await listReports(supabase, filters, pagination);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-sans text-2xl font-bold text-on-surface">Laporan Read-Only</h1>
        <p className="mt-1 font-sans text-sm text-on-surface-variant">
          Mode Audit — Hanya Baca. {result.totalCount} laporan ditemukan.
        </p>
      </div>

      {result.items.length === 0 ? (
        <EmptyState title="Tidak ada laporan" description="Belum ada laporan yang sesuai dengan filter ini." />
      ) : (
        <ul className="flex flex-col gap-3">
          {result.items.map((report) => (
            <li key={report.id} className="flex flex-col gap-2 rounded-md border border-brand-border bg-surface-container-lowest p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StatusBadge label={reportStatusLabelsInternal[report.status]} tone="info" />
                <span className="font-mono text-xs text-on-surface-variant">{report.id}</span>
              </div>
              <p className="font-sans text-sm text-on-surface">{report.description ?? "(Tidak ada deskripsi)"}</p>
              <DecisionLineagePanel reportId={report.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
