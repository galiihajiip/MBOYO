import type { Metadata } from "next";
import { EmptyState } from "@mboyo/ui";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { listExportJobs } from "../../../lib/command/exports";
import { ExportForm } from "../../../components/command/ExportForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ekspor — MBOYO" };

interface DisasterEventRow {
  id: string;
  name: string;
}

/**
 * Ekspor (BLOCK 24) — real CSV/GeoJSON export generation (this block's
 * user-approved decision, not a request/status-only stub), scoped
 * exclusively to verified reports (createExportJob queries
 * command_map_reports, the same verified-only view every Coordinator
 * screen uses) — an export can never carry unverified reports or private
 * evidence, per docs/product/data-governance's existing disclosure.
 */
export default async function EksporPage() {
  const supabase = await createServerSupabaseClient();

  const [{ data: events }, jobs] = await Promise.all([
    supabase.from("disaster_events").select("id, name").returns<DisasterEventRow[]>(),
    listExportJobs(supabase),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-sans text-2xl font-bold text-on-surface">Ekspor</h1>

      <ExportForm events={events ?? []} />

      <section className="flex flex-col gap-2">
        <h2 className="font-sans text-sm font-bold text-on-surface">Riwayat Ekspor</h2>
        {jobs.length === 0 ? (
          <EmptyState title="Belum ada ekspor" description="Riwayat permintaan ekspor Anda akan muncul di sini." />
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
