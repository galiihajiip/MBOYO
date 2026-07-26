"use client";

import Link from "next/link";
import { SeverityBadge, Waves, Mountain, Truck, MapPinIcon, ArrowRight, type SeverityClass } from "@mboyo/ui";
import { CrisisMapClient } from "./CrisisMapClient";
import type { CrisisMapClusterPin, CrisisMapReportPin } from "./CrisisMap";
import type { CommandMapReportDto } from "../../lib/command/map";

export interface CommandHomeClientProps {
  reportPins: CrisisMapReportPin[];
  clusterPins: CrisisMapClusterPin[];
  geofenceRingLonLat: [number, number][] | null;
  recentReports: CommandMapReportDto[];
  floodCount: number;
  seismicCount: number;
}

function reportAge(submittedAt: string | null): string {
  if (!submittedAt) return "—";
  return new Date(submittedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Static illustrative logistics snapshot — this codebase's schema has no
 * inventory/posko/supply-tracking tables (response_tasks.category is only a
 * free-text label, e.g. "Distribusi Logistik"), so unlike every other panel
 * on this page these numbers are NOT live data. Kept hardcoded and isolated
 * here per explicit user approval, rather than wiring a real query that
 * would silently fabricate figures a Coordinator might act on.
 */
const LOGISTICS_SNAPSHOT = [
  {
    name: "Posko Utama Wilayah A",
    distanceKm: 8.4,
    stocks: [
      { label: "Food Supplies", percent: 85, tone: "ok" as const },
      { label: "Clean Water", percent: 22, tone: "critical" as const },
      { label: "Medical Kits", percent: 64, tone: "ok" as const },
    ],
  },
  {
    name: "Distribusi Sektor Utara",
    distanceKm: 12.1,
    stocks: [
      { label: "Food Supplies", percent: 40, tone: "ok" as const },
      { label: "Medical Kits", percent: 92, tone: "ok" as const },
    ],
  },
];

export function CommandHomeClient({
  reportPins,
  clusterPins,
  geofenceRingLonLat,
  recentReports,
  floodCount,
  seismicCount,
}: CommandHomeClientProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="relative">
          <CrisisMapClient
            reportPins={reportPins}
            clusterPins={clusterPins}
            geofenceRingLonLat={geofenceRingLonLat}
          />
          <div className="pointer-events-none absolute left-3 top-3 z-10 max-w-xs rounded-xl border border-brand-border bg-surface-container-lowest/95 p-4 shadow-lg backdrop-blur-md">
            <h3 className="mb-2 font-sans text-sm font-bold text-on-surface">Peta Respon Aktif</h3>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <span className="text-brand-critical-red">
                  <Waves className="h-4 w-4" />
                </span>
                <div className="flex flex-1 items-baseline justify-between gap-2">
                  <span className="font-sans text-xs font-semibold text-on-surface">Banjir Bandang</span>
                  <span className="font-mono text-xs font-bold text-brand-critical-red">
                    {String(floodCount).padStart(2, "0")} Titik
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-brand-relief-teal">
                  <Mountain className="h-4 w-4" />
                </span>
                <div className="flex flex-1 items-baseline justify-between gap-2">
                  <span className="font-sans text-xs font-semibold text-on-surface">Erupsi/Gempa</span>
                  <span className="font-mono text-xs font-bold text-brand-relief-teal">
                    {String(seismicCount).padStart(2, "0")} Titik
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-brand-border bg-surface-container-lowest">
          <div className="flex items-center justify-between border-b border-brand-border px-5 py-4">
            <div className="flex items-center gap-3">
              <h2 className="font-sans text-base font-bold text-on-surface">Laporan Terbaru</h2>
              <span className="rounded-full bg-brand-critical-red/10 px-3 py-1 font-sans text-xs font-bold text-brand-critical-red">
                {recentReports.filter((r) => r.topSeverity === "destroyed" || r.escalated).length} KRITIS
              </span>
              <span className="rounded-full bg-surface-container-high px-3 py-1 font-sans text-xs font-bold text-on-surface">
                {recentReports.length} TOTAL
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentReports.length === 0 ? (
              <p className="col-span-full py-6 text-center font-sans text-sm text-on-surface-variant">
                Belum ada laporan terverifikasi.
              </p>
            ) : (
              recentReports.slice(0, 6).map((report) => (
                <Link
                  key={report.id}
                  href={`/command/tugas/baru?reportId=${report.id}`}
                  className="group flex flex-col gap-2 rounded-xl border border-brand-border bg-surface-container-lowest p-4 transition-colors hover:border-brand-signal-cyan"
                >
                  <div className="flex items-start justify-between gap-2">
                    {report.topSeverity ? (
                      <SeverityBadge severity={report.topSeverity as SeverityClass} />
                    ) : (
                      <span className="font-sans text-xs text-on-surface-variant">Belum dianalisis</span>
                    )}
                    <span className="font-mono text-[10px] text-on-surface-variant">{reportAge(report.submittedAt)}</span>
                  </div>
                  <p className="line-clamp-1 font-sans text-sm font-bold text-on-surface">
                    {report.description ?? "(Tidak ada deskripsi)"}
                  </p>
                  <p className="flex items-center gap-1 font-mono text-[11px] text-on-surface-variant">
                    <MapPinIcon className="h-3.5 w-3.5" />
                    {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}
                  </p>
                  <div className="mt-1 flex items-center justify-between">
                    {report.escalated ? (
                      <span className="rounded-full bg-brand-caution-amber/15 px-2 py-0.5 font-sans text-[10px] font-bold text-brand-caution-amber">
                        Dieskalasi
                      </span>
                    ) : (
                      <span />
                    )}
                    <span className="flex items-center gap-1 font-sans text-xs font-semibold text-brand-signal-cyan opacity-0 transition-opacity group-hover:opacity-100">
                      Buat Tugas <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      <aside className="flex w-full flex-col gap-4 rounded-2xl border border-brand-border bg-surface-container-lowest p-5 lg:w-[340px] lg:shrink-0">
        <div>
          <h2 className="font-sans text-base font-bold text-on-surface">Logistik &amp; Sumber Daya</h2>
          <p className="font-sans text-[11px] uppercase tracking-wide text-on-surface-variant">Ilustratif — belum terhubung ke data live</p>
        </div>

        {LOGISTICS_SNAPSHOT.map((posko, i) => (
          <div key={posko.name} className="flex flex-col gap-3">
            {i > 0 ? <hr className="border-brand-border" /> : null}
            <div className="flex items-center justify-between">
              <span className="font-sans text-sm font-bold text-on-surface">{posko.name}</span>
              <span className="font-mono text-xs text-brand-relief-teal">{posko.distanceKm} KM</span>
            </div>
            <div className="flex flex-col gap-3">
              {posko.stocks.map((stock) => (
                <div key={stock.label}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-sans text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
                      {stock.label}
                    </span>
                    <span
                      className={`font-mono text-xs font-bold ${stock.tone === "critical" ? "text-brand-critical-red" : "text-on-surface"}`}
                    >
                      {stock.percent}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
                    <div
                      className={`h-full rounded-full ${stock.tone === "critical" ? "bg-brand-critical-red" : "bg-brand-relief-teal"}`}
                      style={{ width: `${stock.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="mt-1 rounded-xl border border-dashed border-brand-border bg-surface-container-low p-4">
          <div className="flex items-start gap-3">
            <span className="text-brand-relief-teal">
              <Truck className="h-5 w-5" />
            </span>
            <div>
              <p className="font-sans text-sm font-bold text-on-surface">Dalam Perjalanan</p>
              <p className="font-sans text-xs text-on-surface-variant">3 truk bantuan medis sedang menuju Posko Utara.</p>
              <p className="mt-1 font-mono text-[10px] font-bold text-brand-relief-teal">ETA: 45 MENIT</p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
