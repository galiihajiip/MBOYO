import type { Metadata } from "next";
import { EmptyState, MetricCard } from "@mboyo/ui";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import {
  getIntegrationUsageSummary,
  getServiceHealthSummary,
  getStorageUsageSummaries,
  getUserActivitySummary,
} from "../../../lib/admin/analytics";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kesehatan Sistem — MBOYO" };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Kesehatan Sistem (BLOCK 26) — replacing the earlier stub. Per this
 * block's Admin requirement: service health, failures, storage, user
 * activity, integration usage — all read-only per RBAC_MATRIX.md ("Admin
 * cannot validate, dispatch, or change audit events"); nothing on this
 * page writes to reports/response_tasks/verification_reviews.
 */
export default async function KesehatanSistemPage() {
  const supabase = await createServerSupabaseClient();
  const [serviceHealth, storageUsage, userActivity, integrationUsage] = await Promise.all([
    getServiceHealthSummary(supabase),
    getStorageUsageSummaries(supabase),
    getUserActivitySummary(supabase),
    getIntegrationUsageSummary(supabase),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-sans text-2xl font-bold text-on-surface">Kesehatan Sistem</h1>

      <section className="flex flex-col gap-3">
        <h2 className="font-sans text-lg font-bold text-on-surface">Status Layanan Analisis</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard label="Menunggu" value={serviceHealth.analysisJobsQueued} />
          <MetricCard label="Sedang Diproses" value={serviceHealth.analysisJobsProcessing} />
          <MetricCard label="Gagal" value={serviceHealth.analysisJobsFailed} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Median Durasi Pekerjaan (7 hari)"
            value={serviceHealth.medianJobDurationSeconds === null ? "—" : `${serviceHealth.medianJobDurationSeconds.toFixed(1)} dtk`}
          />
          <MetricCard
            label="Median Latensi Model (7 hari)"
            value={serviceHealth.medianModelLatencyMs === null ? "—" : `${serviceHealth.medianModelLatencyMs.toFixed(0)} md`}
          />
          <MetricCard label="Eskalasi (7 hari)" value={serviceHealth.escalationCount7d} />
          <MetricCard label="Gagal Unduh Bukti (7 hari)" value={serviceHealth.evidenceDownloadFailureCount7d} />
        </div>

        {serviceHealth.recentFailures.length === 0 ? (
          <EmptyState title="Tidak ada kegagalan analisis" description="Tidak ada pekerjaan analisis yang gagal baru-baru ini." />
        ) : (
          <ul className="flex flex-col gap-2">
            {serviceHealth.recentFailures.map((failure) => (
              <li key={failure.reportId} className="rounded-md border border-brand-border bg-surface-container-lowest p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs text-on-surface-variant">{failure.reportId}</span>
                  <span className="font-sans text-xs text-on-surface-variant">Percobaan: {failure.attempts}</span>
                </div>
                <p className="mt-1 font-sans text-sm text-on-surface">{failure.error ?? "(Tidak ada pesan kesalahan)"}</p>
                <span className="font-mono text-xs text-on-surface-variant">
                  {new Date(failure.createdAt).toLocaleString("id-ID")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-sans text-lg font-bold text-on-surface">Penggunaan Penyimpanan</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {storageUsage.map((summary) => (
            <MetricCard
              key={summary.bucket}
              label={summary.bucket}
              value={`${summary.objectCount} objek · ${formatBytes(summary.totalBytes)}`}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-sans text-lg font-bold text-on-surface">Aktivitas Pengguna</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {userActivity.map((summary) => (
            <MetricCard key={summary.role} label={summary.role} value={summary.activeUserCount} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-sans text-lg font-bold text-on-surface">Penggunaan Integrasi</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard label="Permintaan Gemini" value={integrationUsage.geminiRequestCount} />
          <MetricCard label="Gemini Berhasil" value={integrationUsage.geminiSuccessCount} />
          <MetricCard label="Langganan Push Aktif" value={integrationUsage.pushSubscriptionCount} />
        </div>
      </section>
    </div>
  );
}
