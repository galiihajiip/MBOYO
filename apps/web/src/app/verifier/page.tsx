import type { Metadata } from "next";
import Link from "next/link";
import { MetricCard } from "@mboyo/ui";
import { getCurrentUser } from "../../lib/auth/server";
import { createServerSupabaseClient } from "../../lib/supabase/server";
import { getVerifierDashboardMetrics, SLA_WARNING_HOURS } from "../../lib/reports/service/dashboard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ringkasan — MBOYO" };

/**
 * Ringkasan (Verifier dashboard) — BLOCK 23. Six at-a-glance metrics per
 * docs/product/SCREEN_INVENTORY.md: waiting count, SLA warnings, low
 * quality, duplicates, high severity, decisions today. Each metric links
 * to the Antrean Verifikasi queue pre-filtered to that exact signal, so
 * the dashboard is a real navigation entry point, not a dead end.
 */
export default async function VerifierHomePage() {
  const user = await getCurrentUser();
  const supabase = await createServerSupabaseClient();
  const metrics = await getVerifierDashboardMetrics(supabase);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-sans text-2xl font-bold text-on-surface">Selamat datang, {user?.displayName}</h1>
        <p className="mt-2 font-sans text-sm text-on-surface-variant">
          Ringkasan kedalaman antrean, status SLA, dan keputusan terbaru.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/verifier/antrean">
          <MetricCard label="Menunggu Tinjauan" value={metrics.waitingCount} />
        </Link>
        <Link href={`/verifier/antrean?minAgeHours=${SLA_WARNING_HOURS}`}>
          <MetricCard
            label="Peringatan SLA"
            value={metrics.slaWarningCount}
            trend={
              metrics.slaWarningCount > 0
                ? { direction: "down", label: `>${SLA_WARNING_HOURS} jam menunggu` }
                : undefined
            }
          />
        </Link>
        <Link href="/verifier/antrean?maxQualityScore=0.5">
          <MetricCard label="Kualitas Rendah" value={metrics.lowQualityCount} />
        </Link>
        <Link href="/verifier/antrean?hasDuplicateCandidate=true">
          <MetricCard label="Duplikat Terdeteksi" value={metrics.duplicateCount} />
        </Link>
        <Link href="/verifier/antrean?predictedSeverity=destroyed">
          <MetricCard label="Keparahan Tinggi" value={metrics.highSeverityCount} />
        </Link>
        <MetricCard label="Keputusan Hari Ini" value={metrics.decisionsToday} />
      </div>
    </div>
  );
}
