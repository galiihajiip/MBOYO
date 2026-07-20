"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, EmptyState, SeverityBadge, StatusBadge } from "@mboyo/ui";
import { reportStatusLabelsReporter } from "@mboyo/ui";
import { useReportRepository } from "../../../lib/reports/use-report-repository";
import type { ReportListItem } from "../../../lib/reports/repository";

const STATUS_LABEL: Record<string, string> = {
  ...reportStatusLabelsReporter,
  syncing: "Sedang menyinkronkan...",
  submitted: "Laporan terkirim",
  failed: "Gagal — akan dicoba lagi",
};

/**
 * Reads from the OfflineReportRepository seam, backed by the real Dexie/
 * IndexedDB queue (lib/offline/dexie-report-repository.ts). A client
 * component because IndexedDB only exists in the browser — this is
 * inherent to the local-first design, not a temporary limitation.
 */
export function ReportListClient() {
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

  if (reports === null) {
    return <p className="font-sans text-sm text-on-surface-variant">Memuat...</p>;
  }

  if (reports.length === 0) {
    return (
      <EmptyState
        title="Belum ada laporan"
        description="Laporan yang Anda buat akan muncul di sini."
        action={
          <Link
            href="/reporter/laporan/baru"
            className="inline-flex min-h-11 items-center rounded-md bg-brand-ink-navy px-4 font-sans text-sm font-semibold text-brand-cloud-white hover:bg-brand-deep-ocean"
          >
            Buat Laporan Baru
          </Link>
        }
      />
    );
  }

  return (
    <DataTable<ReportListItem>
      columns={[
        { key: "title", header: "Judul", render: (r) => r.title },
        {
          key: "severity",
          header: "Perkiraan Kerusakan",
          render: (r) => (r.observedSeverity ? <SeverityBadge severity={r.observedSeverity} /> : "—"),
        },
        {
          key: "status",
          header: "Status",
          render: (r) => <StatusBadge label={STATUS_LABEL[r.status] ?? r.status} tone="info" />,
        },
      ]}
      rows={reports}
      getRowKey={(r) => r.clientReportId}
      onRowClick={(r) => router.push(`/reporter/laporan/${r.clientReportId}`)}
    />
  );
}
