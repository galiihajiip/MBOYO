import type { Metadata } from "next";
import { BarChart, MetricCard, severityColors, severityLabels, reportStatusLabelsInternal } from "@mboyo/ui";
import type { SeverityClass, ReportStatus } from "@mboyo/domain";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { getIncidentAnalytics, getResponseSlaSummary, getSubmissionTimeline } from "../../../lib/command/analytics";
import { listClusterSummaries } from "../../../lib/command/clusters";
import { listResponseTasks } from "../../../lib/command/tasks";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Analitik — MBOYO" };

function formatSeconds(seconds: number | null): string {
  if (seconds === null) return "—";
  const hours = seconds / 3600;
  if (hours < 1) return `${Math.round(seconds / 60)} menit`;
  return `${hours.toFixed(1)} jam`;
}

/**
 * Analitik (BLOCK 24, extended in BLOCK 26) — severity/status/wilayah
 * breakdowns (BLOCK 24, now rendered via the accessible BarChart primitive
 * instead of the old ARIA-less BreakdownBar), plus this block's additional
 * "clusters, tasks, response SLA, geography, timeline" requirements.
 * "Geography" is the same wilayah/disaster_event proxy BLOCK 24 already
 * disclosed (no dedicated region column exists in this schema).
 */
export default async function AnalitikPage() {
  const supabase = await createServerSupabaseClient();
  const [analytics, clusters, tasksResult, sla, timeline] = await Promise.all([
    getIncidentAnalytics(supabase),
    listClusterSummaries(supabase),
    listResponseTasks(supabase, {}, { page: 1, pageSize: 100 }),
    getResponseSlaSummary(supabase),
    getSubmissionTimeline(supabase, 14),
  ]);

  const severityData = Object.entries(analytics.bySeverity).map(([severity, count]) => ({
    label: severityLabels[severity as SeverityClass],
    value: count ?? 0,
    color: severityColors[severity as SeverityClass],
  }));

  const statusData = Object.entries(analytics.byStatus).map(([status, count]) => ({
    label: reportStatusLabelsInternal[status as ReportStatus],
    value: count ?? 0,
  }));

  const regionData = analytics.byRegion.map((region) => ({ label: region.name, value: region.count }));

  const timelineData = timeline.map((point) => ({
    label: new Date(point.date).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit" }),
    value: point.count,
  }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-sans text-2xl font-bold text-on-surface">Analitik</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Klaster Insiden" value={clusters.length} />
        <MetricCard label="Total Tugas Respons" value={tasksResult.totalCount} />
        <MetricCard label="Median Waktu Respons" value={formatSeconds(sla.medianResponseTimeSeconds)} />
        <MetricCard label="Tugas Terlambat" value={sla.overdueCount} />
      </div>

      <section className="rounded-md border border-brand-border p-4">
        <BarChart title="Berdasarkan Tingkat Keparahan" data={severityData} />
      </section>

      <section className="rounded-md border border-brand-border p-4">
        <BarChart title="Berdasarkan Status" data={statusData} />
      </section>

      <section className="rounded-md border border-brand-border p-4">
        {regionData.length === 0 ? (
          <p className="font-sans text-sm text-on-surface-variant">Belum ada data wilayah.</p>
        ) : (
          <BarChart title="Berdasarkan Wilayah (Event Bencana)" data={regionData} />
        )}
      </section>

      <section className="rounded-md border border-brand-border p-4">
        <BarChart title="Garis Waktu Pengiriman Laporan (14 Hari Terakhir)" data={timelineData} unit=" laporan" />
      </section>
    </div>
  );
}
