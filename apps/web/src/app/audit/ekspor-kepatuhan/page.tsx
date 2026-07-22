import type { Metadata } from "next";
import { EmptyState } from "@mboyo/ui";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { listExportJobs } from "../../../lib/command/exports";
import { ExportForm } from "../../../components/command/ExportForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Export Compliance — MBOYO" };

interface DisasterEventRow {
  id: string;
  name: string;
}

/**
 * Export Compliance (BLOCK 26) — replacing the earlier stub. Reuses the
 * exact same ExportForm/createExportJob real CSV/GeoJSON/JSON generation
 * Coordinator's Ekspor uses (per RBAC_MATRIX.md's Auditor "R/E (compliance
 * export)" — the one export_job:create permission this role holds), and
 * lists every export_jobs row org-wide (export_jobs_auditor_all_read RLS),
 * not just the Auditor's own — this IS the "riwayat seluruh ekspor
 * organisasi" the earlier stub promised.
 */
export default async function EksporKepatuhanPage() {
  const supabase = await createServerSupabaseClient();

  const [{ data: events }, jobs] = await Promise.all([
    supabase.from("disaster_events").select("id, name").returns<DisasterEventRow[]>(),
    listExportJobs(supabase),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-sans text-2xl font-bold text-on-surface">Export Compliance</h1>

      <ExportForm events={events ?? []} endpoint="/api/audit/exports" />

      <section className="flex flex-col gap-2">
        <h2 className="font-sans text-sm font-bold text-on-surface">Riwayat Ekspor Organisasi</h2>
        {jobs.length === 0 ? (
          <EmptyState title="Belum ada ekspor" description="Riwayat ekspor seluruh organisasi akan muncul di sini." />
        ) : (
          <ul className="flex flex-col gap-2">
            {jobs.map((job) => (
              <li
                key={job.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-brand-border bg-surface-container-lowest p-3"
              >
                <span className="font-sans text-sm text-on-surface">
                  {job.format.toUpperCase()} · {job.status}
                </span>
                <span className="font-mono text-xs text-on-surface-variant">
                  {new Date(job.createdAt).toLocaleString("id-ID")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
