"use client";

import { useEffect, useState } from "react";
import { EmptyState, SeverityBadge, StatusBadge, reportStatusLabelsReporter } from "@mboyo/ui";
import { useReportRepository } from "../../../../lib/reports/use-report-repository";
import type { ReportListItem } from "../../../../lib/reports/repository";

export interface ReportDetailClientProps {
  clientReportId: string;
}

const STATUS_LABEL: Record<string, string> = {
  ...reportStatusLabelsReporter,
  syncing: "Sedang menyinkronkan...",
  submitted: "Laporan terkirim",
  failed: "Gagal — akan dicoba lagi",
};

/**
 * Own-report detail — per docs/product/SCREEN_INVENTORY.md "Laporan Saya —
 * Detail": read-only once submitted, no Verifier internal notes/
 * probabilities exposed (this Reporter-facing view never had access to
 * that data in the first place, per lib/reports/repository.ts's
 * ReportListItem shape).
 */
export function ReportDetailClient({ clientReportId }: ReportDetailClientProps) {
  const repository = useReportRepository();
  const [report, setReport] = useState<ReportListItem | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void repository.getOwnReport(clientReportId).then((item) => {
      if (!cancelled) setReport(item);
    });
    return () => {
      cancelled = true;
    };
  }, [repository, clientReportId]);

  if (report === undefined) {
    return <p className="font-sans text-sm text-on-surface-variant">Memuat...</p>;
  }

  if (report === null) {
    return (
      <EmptyState
        title="Laporan tidak ditemukan"
        description="Laporan ini tidak ditemukan atau bukan milik Anda."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-sans text-2xl font-bold text-on-surface">{report.title}</h1>
      <div className="flex flex-wrap gap-2">
        {report.observedSeverity ? <SeverityBadge severity={report.observedSeverity} /> : null}
        <StatusBadge label={STATUS_LABEL[report.status] ?? report.status} tone="info" />
      </div>
      <p className="font-mono text-xs text-on-surface-variant">
        Terakhir diperbarui: {new Date(report.updatedAtClient).toLocaleString("id-ID")}
      </p>
    </div>
  );
}
