"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DataTable,
  EmptyState,
  SeverityBadge,
  StatusBadge,
  ArrowRight,
  PlusCircle,
  CloudOff,
  FileText,
  ClockIcon,
  CheckCircle,
  reportStatusLabelsReporter,
  type StatusTone,
} from "@mboyo/ui";
import { useReportRepository } from "../../lib/reports/use-report-repository";
import type { ReportListItem } from "../../lib/reports/repository";

const STATUS_LABEL: Record<string, string> = {
  ...reportStatusLabelsReporter,
  syncing: "Sedang menyinkronkan...",
  submitted: "Laporan terkirim",
  failed: "Gagal — akan dicoba lagi",
};

const STATUS_TONE: Record<string, StatusTone> = {
  draft_local: "neutral",
  queued_offline: "warning",
  syncing: "info",
  submitted: "info",
  failed: "critical",
  analysis_completed: "info",
  needs_manual_review: "warning",
  verified: "success",
  rejected: "critical",
};

function isDraft(status: ReportListItem["status"]): boolean {
  return status === "draft_local";
}
function isQueued(status: ReportListItem["status"]): boolean {
  return status === "queued_offline" || status === "syncing";
}
function isPendingReview(status: ReportListItem["status"]): boolean {
  return status === "submitted" || status === "analysis_completed" || status === "needs_manual_review";
}
function isVerified(status: ReportListItem["status"]): boolean {
  return status === "verified";
}

export interface ReporterDashboardClientProps {
  displayName: string;
}

/**
 * Reporter's Beranda dashboard — replaces the old plain-text welcome block
 * with a data-driven summary: counts by pipeline stage (draft/queued/
 * pending-review/verified) sourced from the same OfflineReportRepository
 * seam every other Reporter screen already reads from (IndexedDB via
 * useReportRepository — see ReportListClient.tsx's identical pattern), a
 * recent-reports table, and an offline-queue callout. Client component
 * because IndexedDB only exists in the browser, same reason
 * ReportListClient.tsx is one.
 */
export function ReporterDashboardClient({ displayName }: ReporterDashboardClientProps) {
  const repository = useReportRepository();
  const router = useRouter();
  const [reports, setReports] = useState<ReportListItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void repository.listOwnReports().then((items) => {
      if (!cancelled) setReports(items);
    });
    return () => {
      cancelled = true;
    };
  }, [repository]);

  const loaded = reports ?? [];
  const draftCount = loaded.filter((r) => isDraft(r.status)).length;
  const queuedCount = loaded.filter((r) => isQueued(r.status)).length;
  const pendingReviewCount = loaded.filter((r) => isPendingReview(r.status)).length;
  const verifiedCount = loaded.filter((r) => isVerified(r.status)).length;
  const recent = [...loaded]
    .sort((a, b) => new Date(b.updatedAtClient).getTime() - new Date(a.updatedAtClient).getTime())
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-sans text-3xl font-extrabold tracking-tight text-on-surface">
          Selamat datang, {displayName}
        </h1>
        <p className="mt-1 font-sans text-sm text-on-surface-variant">
          Buat laporan baru kapan saja — bahkan tanpa koneksi internet. Laporan Anda akan
          tersimpan dan terkirim otomatis begitu koneksi tersedia.
        </p>
      </div>

      {/* Hero CTA */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-ink-navy to-brand-deep-ocean p-8 shadow-lg">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-brand-signal-cyan/10" />
        <div className="pointer-events-none absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-brand-relief-teal/10" />
        <div className="relative flex flex-col gap-4">
          <h2 className="font-sans text-2xl font-bold text-white">Laporkan Kerusakan</h2>
          <p className="max-w-2xl font-sans text-sm text-white/80">
            Laporkan temuan infrastruktur yang rusak atau kendala di lapangan secara real-time.
            Laporan Anda membantu koordinasi respons yang lebih cepat.
          </p>
          <Link
            href="/reporter/laporan/baru"
            className="flex min-h-11 w-fit items-center gap-2 rounded-lg bg-brand-signal-cyan px-5 font-sans text-sm font-bold text-brand-night shadow-md hover:brightness-95"
          >
            <PlusCircle className="h-5 w-5" />
            Mulai Laporan
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="flex flex-col gap-1 rounded-xl border border-brand-border bg-surface-container-lowest p-4 shadow-sm">
          <span className="font-sans text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Draf</span>
          <span className="font-mono text-2xl font-bold text-on-surface">{draftCount}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-brand-border bg-surface-container-lowest p-4 shadow-sm">
          <span className="font-sans text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Menunggu Sinkronisasi
          </span>
          <span className="font-mono text-2xl font-bold text-brand-caution-amber">{queuedCount}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-brand-border bg-surface-container-lowest p-4 shadow-sm">
          <span className="font-sans text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Menunggu Verifikasi
          </span>
          <span className="font-mono text-2xl font-bold text-brand-signal-cyan">{pendingReviewCount}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-brand-border bg-surface-container-lowest p-4 shadow-sm">
          <span className="font-sans text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Terverifikasi
          </span>
          <span className="font-mono text-2xl font-bold text-brand-safe-green">{verifiedCount}</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Recent reports table */}
        <div className="overflow-hidden rounded-xl border border-brand-border bg-surface-container-lowest shadow-sm lg:col-span-8">
          <div className="flex items-center justify-between border-b border-brand-border bg-surface-container-low px-4 py-3">
            <h3 className="font-sans text-base font-bold text-on-surface">Laporan Terbaru</h3>
            <Link
              href="/reporter/laporan"
              className="flex items-center gap-1 font-sans text-sm font-semibold text-brand-signal-cyan hover:underline"
            >
              Lihat Semua
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {reports === null ? (
            <p className="p-4 font-sans text-sm text-on-surface-variant">Memuat...</p>
          ) : recent.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="Belum ada laporan"
                description="Laporan yang Anda buat akan muncul di sini."
                icon={<FileText className="h-8 w-8" />}
              />
            </div>
          ) : (
            <DataTable
              columns={[
                {
                  key: "title",
                  header: "Judul & Severity",
                  render: (row) => (
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-on-surface">{row.title || "(Tanpa judul)"}</span>
                      {row.observedSeverity ? <SeverityBadge severity={row.observedSeverity} /> : null}
                    </div>
                  ),
                },
                {
                  key: "updated",
                  header: "Waktu",
                  render: (row) => (
                    <span className="flex items-center gap-1 font-mono text-xs text-on-surface-variant">
                      <ClockIcon className="h-3.5 w-3.5" />
                      {new Date(row.updatedAtClient).toLocaleString("id-ID", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => (
                    <StatusBadge
                      label={STATUS_LABEL[row.status] ?? row.status}
                      tone={STATUS_TONE[row.status] ?? "neutral"}
                    />
                  ),
                },
              ]}
              rows={recent}
              getRowKey={(row) => row.clientReportId}
              onRowClick={(row) => router.push(`/reporter/laporan/${row.clientReportId}`)}
            />
          )}
        </div>

        {/* Offline queue callout */}
        <div className="flex flex-col gap-3 rounded-xl border border-brand-border bg-surface-container-lowest p-4 shadow-sm lg:col-span-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-caution-amber/15 text-brand-caution-amber">
              <CloudOff className="h-5 w-5" />
            </span>
            <div>
              <p className="font-sans text-sm font-bold text-on-surface">Antrean Offline</p>
              <p className="font-sans text-xs text-on-surface-variant">
                {queuedCount > 0 ? "Menunggu koneksi stabil" : "Semua laporan tersinkronisasi"}
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-brand-border bg-surface-container-low p-3 text-center">
            <span className="block font-mono text-2xl font-bold text-on-surface">{queuedCount}</span>
            <span className="font-sans text-xs text-on-surface-variant">Laporan dalam Antrean</span>
          </div>
          <Link
            href="/reporter/antrean"
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-deep-ocean font-sans text-sm font-semibold text-white hover:bg-brand-ink-navy"
          >
            <CheckCircle className="h-4 w-4" />
            Lihat Antrean
          </Link>
        </div>
      </div>
    </div>
  );
}
