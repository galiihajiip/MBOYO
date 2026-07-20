"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, StatusBadge, reportStatusLabelsInternal, type DataTableColumn } from "@mboyo/ui";
import type { ReportSummaryDto } from "../../lib/reports/service/types";

const COLUMNS: DataTableColumn<ReportSummaryDto>[] = [
  {
    key: "status",
    header: "Status",
    render: (report) => <StatusBadge label={reportStatusLabelsInternal[report.status]} tone="info" />,
  },
  {
    key: "description",
    header: "Deskripsi",
    render: (report) => report.description ?? "(Tidak ada deskripsi)",
  },
  {
    key: "submittedAt",
    header: "Dikirim",
    align: "right",
    render: (report) => (report.submittedAt ? new Date(report.submittedAt).toLocaleString("id-ID") : "—"),
  },
];

export interface AllReportsListProps {
  reports: ReportSummaryDto[];
}

/** Semua Laporan's list (BLOCK 23) — same desktop-table/mobile-card-list responsive split as QueueList, view-only (no bulk actions, per SCREEN_INVENTORY.md). */
export function AllReportsList({ reports }: AllReportsListProps) {
  const router = useRouter();

  if (reports.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-brand-border p-6 text-center font-sans text-sm text-on-surface-variant">
        Belum ada laporan.
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
          onRowClick={(report) => router.push(`/verifier/laporan/${report.id}`)}
        />
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {reports.map((report) => (
          <li key={report.id}>
            <Link
              href={`/verifier/laporan/${report.id}`}
              className="flex flex-col gap-2 rounded-md border border-brand-border bg-surface-container-lowest p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <StatusBadge label={reportStatusLabelsInternal[report.status]} tone="info" />
                <span className="font-mono text-xs text-on-surface-variant">
                  {report.submittedAt ? new Date(report.submittedAt).toLocaleDateString("id-ID") : "—"}
                </span>
              </div>
              <p className="line-clamp-2 font-sans text-sm text-on-surface">
                {report.description ?? "(Tidak ada deskripsi)"}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
