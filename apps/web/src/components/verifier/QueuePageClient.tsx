"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Inbox, Brain, ListChecks } from "@mboyo/ui";
import { QueueList } from "./QueueList";
import { QueueDetailPreview } from "./QueueDetailPreview";
import type { QueueReportSummaryDto } from "../../lib/reports/service/types";

export interface QueuePageClientProps {
  reports: QueueReportSummaryDto[];
  totalCount: number;
  averageConfidencePercent: number | null;
  completedTodayCount: number;
}

/**
 * Wraps Antrean Verifikasi's summary cards + list + inline detail preview
 * in one client component so selecting a row (opening the preview panel)
 * doesn't need a URL param round-trip through the server component above
 * it — QueueFilters already owns the URL query string for filters, this
 * component owns only the ephemeral "which row is previewed" UI state,
 * which never needs to be bookmarkable.
 */
export function QueuePageClient({
  reports,
  totalCount,
  averageConfidencePercent,
  completedTodayCount,
}: QueuePageClientProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function handleDecided() {
    setSelectedId(null);
    router.refresh();
  }

  return (
    <div className="flex flex-1 gap-4">
      <div className="min-w-0 flex-1">
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex items-start justify-between rounded-2xl border border-brand-border bg-surface-container-lowest p-5 shadow-sm">
            <div>
              <p className="font-sans text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                Antrean Verifikasi
              </p>
              <p className="mt-1 font-mono text-3xl font-bold text-brand-ink-navy">
                {totalCount} <span className="font-sans text-sm font-normal text-on-surface-variant">Laporan</span>
              </p>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-container-high text-brand-ink-navy">
              <Inbox className="h-5 w-5" />
            </span>
          </div>
          <div className="flex items-start justify-between rounded-2xl border border-brand-border bg-surface-container-lowest p-5 shadow-sm">
            <div>
              <p className="font-sans text-xs font-bold uppercase tracking-widest text-on-surface-variant">Akurasi AI</p>
              <p className="mt-1 font-mono text-3xl font-bold text-brand-relief-teal">
                {averageConfidencePercent !== null ? `${averageConfidencePercent}%` : "—"}{" "}
                <span className="font-sans text-sm font-normal text-on-surface-variant">Keyakinan</span>
              </p>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-relief-teal/15 text-brand-relief-teal">
              <Brain className="h-5 w-5" />
            </span>
          </div>
          <div className="flex items-start justify-between rounded-2xl border border-brand-border bg-surface-container-lowest p-5 shadow-sm">
            <div>
              <p className="font-sans text-xs font-bold uppercase tracking-widest text-on-surface-variant">Tugas Anda</p>
              <p className="mt-1 font-mono text-3xl font-bold text-brand-ink-navy">
                {completedTodayCount} <span className="font-sans text-sm font-normal text-on-surface-variant">Selesai</span>
              </p>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-container-high text-brand-ink-navy">
              <ListChecks className="h-5 w-5" />
            </span>
          </div>
        </div>

        <QueueList reports={reports} onRowSelect={setSelectedId} selectedId={selectedId} />
      </div>

      {selectedId ? (
        <QueueDetailPreview reportId={selectedId} onClose={() => setSelectedId(null)} onDecided={handleDecided} />
      ) : null}
    </div>
  );
}
