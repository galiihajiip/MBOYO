import type { Metadata } from "next";
import { BarChart, MetricCard, FileText, TrendingUp, ClockIcon, Sparkles, Package, reportStatusLabelsInternal } from "@mboyo/ui";
import type { ReportStatus } from "@mboyo/domain";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { getIncidentAnalytics, getResponseSlaSummary, getSubmissionTimeline } from "../../../lib/command/analytics";
import { listClusterSummaries } from "../../../lib/command/clusters";
import { listResponseTasks } from "../../../lib/command/tasks";
import { AnalyticsTimelineChart } from "../../../components/command/AnalyticsTimelineChart";
import { SeverityDonut } from "../../../components/command/SeverityDonut";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Analitik — MBOYO" };

function formatSeconds(seconds: number | null): string {
  if (seconds === null) return "—";
  const hours = seconds / 3600;
  if (hours < 1) return `${Math.round(seconds / 60)} menit`;
  return `${hours.toFixed(1)} jam`;
}

/**
 * Static illustrative resource-tracking snapshot — same rationale as
 * CommandHomeClient.tsx's LOGISTICS_SNAPSHOT: this schema has no
 * inventory/allocation table, so unlike every other panel on this page
 * these rows are NOT live data, kept hardcoded and clearly labeled per
 * explicit user approval rather than fabricating a real-looking query.
 */
const RESOURCE_ALLOCATION_SNAPSHOT = [
  { resource: "Beras (Karung 10kg)", sector: "Sektor A-1", demand: 2500, allocated: 2100, status: "84% Terpenuhi" as const, tone: "ok" as const },
  { resource: "Air Bersih (5L)", sector: "Sektor B-4", demand: 5000, allocated: 5000, status: "SELESAI" as const, tone: "complete" as const },
  { resource: "Kit Medis", sector: "Sektor A-2", demand: 450, allocated: 120, status: "KEKURANGAN KRITIS" as const, tone: "critical" as const },
];

const TOP_NEEDS_SNAPSHOT = [
  { label: "AIR BERSIH", mentions: 880, percent: 90 },
  { label: "KIT TEMPAT TINGGAL", mentions: 654, percent: 70 },
  { label: "PERLENGKAPAN BAYI", mentions: 420, percent: 45 },
];

/**
 * Analitik (BLOCK 24/26, redesigned per the Coordinator "Analytics" bento
 * mockup) — every panel keeps using real data already computed by
 * getIncidentAnalytics/getResponseSlaSummary/getSubmissionTimeline/
 * listClusterSummaries/listResponseTasks (nothing here is a new query),
 * just re-laid-out as a bento grid with a timeline chart and severity
 * donut instead of the old stacked BarChart list. The mockup's "Resource
 * Allocation" table and "Top Reported Needs" bars have no backing table in
 * this schema (see RESOURCE_ALLOCATION_SNAPSHOT/TOP_NEEDS_SNAPSHOT above)
 * — kept as clearly-labeled static illustrative panels per explicit user
 * approval, isolated from the real-data panels around them.
 */
export default async function AnalitikPage() {
  const supabase = await createServerSupabaseClient();
  const [analytics, clusters, tasksResult, sla, timeline] = await Promise.all([
    getIncidentAnalytics(supabase),
    listClusterSummaries(supabase),
    listResponseTasks(supabase, {}, { page: 1, pageSize: 100 }),
    getResponseSlaSummary(supabase),
    getSubmissionTimeline(supabase, 30),
  ]);

  const statusData = Object.entries(analytics.byStatus).map(([status, count]) => ({
    label: reportStatusLabelsInternal[status as ReportStatus],
    value: count ?? 0,
  }));

  const regionData = analytics.byRegion.map((region) => ({ label: region.name, value: region.count }));

  const totalReports = Object.values(analytics.byStatus).reduce((sum: number, count) => sum + (count ?? 0), 0);
  const onTimeRate =
    sla.onTimeCompletedCount + sla.overdueCount > 0
      ? Math.round((sla.onTimeCompletedCount / (sla.onTimeCompletedCount + sla.overdueCount)) * 100)
      : null;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-sans text-2xl font-bold text-on-surface">Analitik</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total Laporan" value={totalReports} icon={<FileText className="h-4 w-4" />} />
        <MetricCard label="Median Waktu Respons" value={formatSeconds(sla.medianResponseTimeSeconds)} icon={<ClockIcon className="h-4 w-4" />} />
        <MetricCard
          label="Tugas Tepat Waktu"
          value={onTimeRate !== null ? `${onTimeRate}%` : "—"}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <MetricCard label="Klaster Insiden" value={clusters.length} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="flex flex-col gap-4 rounded-2xl border border-brand-border bg-surface-container-lowest p-5 lg:col-span-2">
          <div>
            <h2 className="font-sans text-base font-bold text-on-surface">Garis Waktu Pengiriman Laporan</h2>
            <p className="font-sans text-xs text-on-surface-variant">30 hari terakhir</p>
          </div>
          <div className="h-56">
            <AnalyticsTimelineChart data={timeline} />
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-brand-border bg-surface-container-lowest p-5">
          <h2 className="font-sans text-base font-bold text-on-surface">Distribusi Keparahan</h2>
          <SeverityDonut bySeverity={analytics.bySeverity} />
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="flex flex-col gap-4 rounded-2xl border border-brand-border bg-surface-container-lowest overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-brand-border bg-surface-container-low px-5 py-4">
            <h2 className="flex items-center gap-2 font-sans text-base font-bold text-on-surface">
              <Package className="h-4 w-4 text-on-surface-variant" />
              Alokasi Sumber Daya
            </h2>
            <span className="rounded-full bg-brand-caution-amber/15 px-2.5 py-1 font-mono text-[10px] font-bold uppercase text-brand-caution-amber">
              Ilustratif
            </span>
          </div>
          <div className="overflow-x-auto px-5 pb-5">
            <table className="w-full text-left font-sans text-sm">
              <thead>
                <tr className="border-b border-brand-border text-xs uppercase text-on-surface-variant">
                  <th className="py-2 pr-4 font-bold">Sumber Daya</th>
                  <th className="py-2 pr-4 font-bold">Sektor</th>
                  <th className="py-2 pr-4 font-bold text-right">Permintaan</th>
                  <th className="py-2 pr-4 font-bold text-right">Alokasi</th>
                  <th className="py-2 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {RESOURCE_ALLOCATION_SNAPSHOT.map((row) => (
                  <tr key={row.resource}>
                    <td className="py-3 pr-4 font-semibold text-on-surface">{row.resource}</td>
                    <td className="py-3 pr-4 text-on-surface-variant">{row.sector}</td>
                    <td className="py-3 pr-4 text-right font-mono text-on-surface">{row.demand.toLocaleString("id-ID")}</td>
                    <td className="py-3 pr-4 text-right font-mono text-on-surface">{row.allocated.toLocaleString("id-ID")}</td>
                    <td className="py-3">
                      <span
                        className={`inline-flex rounded-md px-2 py-1 font-mono text-[11px] font-bold ${
                          row.tone === "critical"
                            ? "bg-brand-critical-red/10 text-brand-critical-red"
                            : row.tone === "complete"
                              ? "bg-brand-relief-teal/15 text-brand-relief-teal"
                              : "bg-brand-safe-green/10 text-brand-safe-green"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex flex-col gap-5 rounded-2xl border border-brand-ink-navy bg-brand-ink-navy p-5 text-white">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-signal-cyan" />
            <h2 className="font-sans text-base font-bold">Wawasan AI</h2>
            <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide text-white/70">
              Ilustratif
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-sans text-[11px] font-bold uppercase tracking-wide text-white/60">Kebutuhan Paling Sering Disebut</p>
            {TOP_NEEDS_SNAPSHOT.map((need) => (
              <div key={need.label} className="space-y-1">
                <div className="flex justify-between font-mono text-[10px] text-white/80">
                  <span>{need.label}</span>
                  <span>{need.mentions} Sebutan</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-brand-signal-cyan" style={{ width: `${need.percent}%` }} />
                </div>
              </div>
            ))}
          </div>

          <p className="mt-auto font-sans text-[10px] italic text-white/50">
            *Contoh ilustratif — belum ada model ekstraksi kebutuhan dari teks laporan di sistem ini.
          </p>
        </section>
      </div>

      <section className="rounded-2xl border border-brand-border bg-surface-container-lowest p-5">
        <BarChart title="Berdasarkan Status" data={statusData} />
      </section>

      <section className="rounded-2xl border border-brand-border bg-surface-container-lowest p-5">
        {regionData.length === 0 ? (
          <p className="font-sans text-sm text-on-surface-variant">Belum ada data wilayah.</p>
        ) : (
          <BarChart title="Berdasarkan Wilayah (Event Bencana)" data={regionData} />
        )}
      </section>
    </div>
  );
}
