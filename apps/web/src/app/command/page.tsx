import type { Metadata } from "next";
import Link from "next/link";
import { MetricCard } from "@mboyo/ui";
import { getCurrentUser } from "../../lib/auth/server";
import { createServerSupabaseClient } from "../../lib/supabase/server";
import { getCommandDashboardMetrics } from "../../lib/command/dashboard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Command Center — MBOYO" };

function formatResponseTime(seconds: number | null): string {
  if (seconds === null) return "—";
  const hours = seconds / 3600;
  if (hours < 1) return `${Math.round(seconds / 60)} menit`;
  return `${hours.toFixed(1)} jam`;
}

/**
 * Command Center dashboard (BLOCK 24) — the six Ringkasan metrics per this
 * block's prompt: verified incidents, critical clusters, unassigned
 * priority, active tasks, overdue tasks, median response time. Each links
 * to a pre-filtered downstream screen, same "dashboard as navigation entry
 * point, not a dead end" pattern as the Verifier's Ringkasan (BLOCK 23).
 */
export default async function CommandCenterPage() {
  const user = await getCurrentUser();
  const supabase = await createServerSupabaseClient();
  const metrics = await getCommandDashboardMetrics(supabase);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-sans text-2xl font-bold text-on-surface">Selamat datang, {user?.displayName}</h1>
        <p className="mt-2 font-sans text-sm text-on-surface-variant">
          Insiden terverifikasi yang memerlukan perhatian dan ringkasan tugas respons aktif.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/command/peta">
          <MetricCard label="Insiden Terverifikasi" value={metrics.verifiedIncidentCount} />
        </Link>
        <Link href="/command/prioritas?priority=critical">
          <MetricCard label="Klaster Kritis" value={metrics.criticalClusterCount} />
        </Link>
        <Link href="/command/tugas?priority=unassigned">
          <MetricCard label="Prioritas Belum Ditentukan" value={metrics.unassignedPriorityCount} />
        </Link>
        <Link href="/command/tugas?status=in_progress">
          <MetricCard label="Tugas Aktif" value={metrics.activeTaskCount} />
        </Link>
        <Link href="/command/tugas?overdueOnly=true">
          <MetricCard
            label="Tugas Terlambat"
            value={metrics.overdueTaskCount}
            trend={metrics.overdueTaskCount > 0 ? { direction: "down", label: "Melewati batas waktu" } : undefined}
          />
        </Link>
        <MetricCard label="Median Waktu Respons" value={formatResponseTime(metrics.medianResponseTimeSeconds)} />
      </div>
    </div>
  );
}
