"use client";

import { DataTable, Badge, SeverityBadge, type DataTableColumn } from "@mboyo/ui";
import type { QueueReportSummaryDto } from "../../lib/reports/service/types";

function ageLabel(submittedAt: string | null): string {
  if (!submittedAt) return "—";
  const hours = Math.floor((Date.now() - new Date(submittedAt).getTime()) / (60 * 60 * 1000));
  if (hours < 1) return "<1 jam";
  if (hours < 24) return `${hours} jam`;
  return `${Math.floor(hours / 24)} hari`;
}

function badges(report: QueueReportSummaryDto) {
  return (
    <div className="flex flex-wrap gap-1">
      {report.escalated ? <Badge tone="critical">Dieskalasi</Badge> : null}
      {report.isAdvisoryOnly ? <Badge tone="warning">Advisory</Badge> : null}
      {report.duplicateCandidateReportId ? <Badge tone="info">Duplikat</Badge> : null}
      {report.qualityScore !== null && report.qualityScore <= 0.5 ? (
        <Badge tone="warning">Kualitas Rendah</Badge>
      ) : null}
    </div>
  );
}

const COLUMNS: DataTableColumn<QueueReportSummaryDto>[] = [
  {
    key: "severity",
    header: "Keparahan",
    render: (report) => (report.topSeverity ? <SeverityBadge severity={report.topSeverity} /> : "—"),
  },
  {
    key: "confidence",
    header: "Keyakinan",
    align: "right",
    render: (report) => (report.topConfidence !== null ? `${Math.round(report.topConfidence * 100)}%` : "—"),
  },
  {
    key: "quality",
    header: "Kualitas",
    align: "right",
    render: (report) => (report.qualityScore !== null ? report.qualityScore.toFixed(2) : "—"),
  },
  {
    key: "gps",
    header: "Akurasi GPS",
    align: "right",
    render: (report) => (report.gpsAccuracyMeters !== null ? `${Math.round(report.gpsAccuracyMeters)}m` : "—"),
  },
  { key: "age", header: "Usia", align: "right", render: (report) => ageLabel(report.submittedAt) },
  { key: "flags", header: "Penanda", render: badges },
];

export interface QueueListProps {
  reports: QueueReportSummaryDto[];
  onRowSelect: (reportId: string) => void;
  selectedId?: string | null;
}

/**
 * Antrean Verifikasi's list — a real <table> on desktop/tablet
 * (DataTable), a card list on mobile, per docs/product/SCREEN_INVENTORY.md's
 * explicit responsive requirement (DataTable itself doesn't auto-collapse —
 * see its own doc comment — so the mobile variant is hand-built here).
 * Selecting a row opens the inline QueueDetailPreview panel (see
 * QueuePageClient) rather than navigating away — the full detail page
 * remains reachable from inside that panel via "Lihat Detail Lengkap".
 */
export function QueueList({ reports, onRowSelect, selectedId }: QueueListProps) {
  if (reports.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-brand-border p-6 text-center font-sans text-sm text-on-surface-variant">
        Tidak ada laporan yang cocok dengan filter saat ini.
      </p>
    );
  }

  return (
    <>
      <div className="hidden md:block">
        <DataTable
          columns={COLUMNS}
          rows={reports}
          getRowKey={(report) => report.id}
          onRowClick={(report) => onRowSelect(report.id)}
          selectedRowKey={selectedId ?? undefined}
        />
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {reports.map((report) => (
          <li key={report.id}>
            <button
              type="button"
              onClick={() => onRowSelect(report.id)}
              className="flex w-full flex-col gap-2 rounded-md border border-brand-border bg-surface-container-lowest p-4 text-left"
            >
              <div className="flex items-center justify-between gap-2">
                {report.topSeverity ? <SeverityBadge severity={report.topSeverity} /> : <span>—</span>}
                <span className="font-mono text-xs text-on-surface-variant">{ageLabel(report.submittedAt)}</span>
              </div>
              <p className="line-clamp-2 font-sans text-sm text-on-surface">
                {report.description ?? "(Tidak ada deskripsi)"}
              </p>
              {badges(report)}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
