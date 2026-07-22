import type { Metadata } from "next";
import { BarChart, MetricCard } from "@mboyo/ui";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { getVerifierAnalytics } from "../../../lib/reports/service/analytics";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Analitik — MBOYO" };

function formatSeconds(seconds: number | null): string {
  if (seconds === null) return "—";
  const hours = seconds / 3600;
  if (hours < 1) return `${Math.round(seconds / 60)} menit`;
  if (hours < 48) return `${hours.toFixed(1)} jam`;
  return `${(hours / 24).toFixed(1)} hari`;
}

/**
 * Verifier Analitik (BLOCK 26) — review count, agreement/override rate,
 * median review time, median queue age, queue-age distribution, and
 * quality distribution, per this block's Verifier requirement. All six
 * metrics/distributions come from getVerifierAnalytics
 * (verifier_review_analytics/verifier_queue_age views, this block's
 * migration).
 */
export default async function VerifierAnalitikPage() {
  const supabase = await createServerSupabaseClient();
  const analytics = await getVerifierAnalytics(supabase);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-sans text-2xl font-bold text-on-surface">Analitik</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Jumlah Tinjauan" value={analytics.reviewCount} />
        <MetricCard label="Tingkat Kesepakatan" value={`${Math.round(analytics.agreementRate * 100)}%`} />
        <MetricCard label="Tingkat Penggantian Klasifikasi" value={`${Math.round(analytics.overrideRate * 100)}%`} />
        <MetricCard label="Median Waktu Tinjauan" value={formatSeconds(analytics.medianReviewTimeSeconds)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MetricCard label="Median Usia Antrean" value={formatSeconds(analytics.medianQueueAgeSeconds)} />
      </div>

      <section className="rounded-md border border-brand-border p-4">
        <BarChart
          title="Distribusi Usia Antrean"
          data={analytics.queueAgeDistribution.map((bucket) => ({ label: bucket.label, value: bucket.count }))}
          unit=" laporan"
        />
      </section>

      <section className="rounded-md border border-brand-border p-4">
        <BarChart
          title="Distribusi Skor Kualitas"
          data={analytics.qualityDistribution.map((bucket) => ({ label: bucket.label, value: bucket.count }))}
          unit=" laporan"
        />
      </section>
    </div>
  );
}
