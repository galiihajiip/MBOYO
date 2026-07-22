import Link from "next/link";
import { Badge, SeverityBadge } from "@mboyo/ui";
import type { CommandMapReportDto } from "../../lib/command/map";
import type { ClusterSummaryDto } from "../../lib/command/types";

export interface CrisisMapListFallbackProps {
  reports: CommandMapReportDto[];
  clusters: ClusterSummaryDto[];
}

/**
 * Accessible list fallback for Peta Krisis (this block's explicit
 * requirement) — always rendered alongside the map, not only when the map
 * fails to load, so every incident/cluster the map shows visually is also
 * reachable via keyboard/screen reader without relying on MapLibre markers
 * (which are not part of the accessibility tree in a way screen readers
 * can reliably navigate).
 */
export function CrisisMapListFallback({ reports, clusters }: CrisisMapListFallbackProps) {
  return (
    <div className="flex flex-col gap-4">
      {clusters.length > 0 ? (
        <div>
          <h2 className="font-sans text-sm font-bold text-on-surface">Klaster Insiden</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {clusters.map((cluster) => (
              <li key={cluster.id}>
                <Link
                  href={`/command/prioritas?clusterId=${cluster.id}`}
                  className="flex flex-col gap-1 rounded-md border border-brand-border bg-surface-container-lowest p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-sans text-sm font-semibold text-on-surface">{cluster.label}</span>
                    <Badge tone={cluster.priority === "critical" ? "critical" : "neutral"}>{cluster.priority}</Badge>
                  </div>
                  <span className="font-sans text-xs text-on-surface-variant">
                    {cluster.memberCount} laporan · {cluster.taskCount} tugas
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <h2 className="font-sans text-sm font-bold text-on-surface">Laporan Terverifikasi</h2>
        {reports.length === 0 ? (
          <p className="mt-2 font-sans text-sm text-on-surface-variant">Tidak ada laporan dengan data lokasi.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {reports.map((report) => (
              <li key={report.id}>
                <Link
                  href={`/command/tugas/baru?reportId=${report.id}`}
                  className="flex flex-col gap-1 rounded-md border border-brand-border bg-surface-container-lowest p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {report.topSeverity ? <SeverityBadge severity={report.topSeverity} /> : null}
                    {report.escalated ? <Badge tone="warning">Dieskalasi</Badge> : null}
                  </div>
                  <span className="line-clamp-2 font-sans text-sm text-on-surface">
                    {report.description ?? "(Tidak ada deskripsi)"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
