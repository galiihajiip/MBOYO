"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { SeverityBadge, X, FileText, type SeverityClass } from "@mboyo/ui";
import type { ReportStatus } from "@mboyo/domain";
import { DecisionPanel } from "./DecisionPanel";

const MapPin = dynamic(() => import("../map/MapPin").then((mod) => mod.MapPin), {
  ssr: false,
  loading: () => (
    <div className="flex h-40 w-full items-center justify-center rounded-xl border border-brand-border bg-surface-container-lowest">
      <p className="font-sans text-xs text-on-surface-variant">Memuat peta...</p>
    </div>
  ),
});

interface PreviewResponse {
  report: { id: string; status: ReportStatus; description: string | null; submittedAt: string | null };
  location: { longitude: number; latitude: number; manualAddress: string | null; accuracyMeters: number | null } | null;
  evidence: { id: string; signedUrl: string; thumbnailSignedUrl: string | null }[];
  prediction: {
    topSeverity: SeverityClass | null;
    topConfidence: number | null;
    qualityScore: number | null;
    isAdvisoryOnly: boolean;
  } | null;
}

const DECIDABLE_STATUSES = new Set<ReportStatus>(["analysis_completed", "needs_manual_review"]);

export interface QueueDetailPreviewProps {
  reportId: string;
  onClose: () => void;
  onDecided: () => void;
}

/**
 * Antrean Verifikasi's inline "Detail Preview" side panel — opened by
 * clicking a queue row (see QueueList.tsx), fetches
 * /api/verifier/reports/[reportId]/preview for photos/AI analysis/location,
 * and embeds the existing DecisionPanel so a Verifier can act (confirm/
 * override/reject/request_info/escalate/insufficient_evidence) without
 * leaving the queue. This does NOT replace the full detail page
 * (/verifier/laporan/[reportId]) — that remains reachable via "Lihat Detail
 * Lengkap" for review history / Gemini advisory / duplicate-candidate
 * context this panel deliberately omits to stay fast to open.
 */
export function QueueDetailPreview({ reportId, onClose, onDecided }: QueueDetailPreviewProps) {
  const [data, setData] = useState<PreviewResponse | null>(null);
  const [activePhoto, setActivePhoto] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    setData(null);
    setActivePhoto(0);
    setError(false);
    fetch(`/api/verifier/reports/${reportId}/preview`)
      .then((res) => res.json())
      .then((json: { ok: boolean; data?: PreviewResponse }) => {
        if (json.ok && json.data) {
          setData(json.data);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true));
  }, [reportId]);

  return (
    <aside className="flex h-full w-full flex-col overflow-y-auto border-l border-brand-border bg-surface-container-lowest lg:w-[420px] lg:shrink-0">
      <div className="flex items-center justify-between border-b border-brand-border bg-surface-container-lowest p-5">
        <div>
          <p className="font-sans text-xs font-bold uppercase tracking-wide text-on-surface-variant">Detail Preview</p>
          <h2 className="font-sans text-lg font-bold text-on-surface">Laporan #{reportId.slice(0, 8).toUpperCase()}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup panel detail"
          className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant hover:bg-brand-mist"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-5 p-5">
        {error ? (
          <p className="font-sans text-sm text-brand-critical-red">Gagal memuat detail laporan.</p>
        ) : !data ? (
          <p className="font-sans text-sm text-on-surface-variant">Memuat...</p>
        ) : (
          <>
            {/* Photo gallery */}
            <div className="flex flex-col gap-3">
              {data.evidence.length > 0 ? (
                <>
                  <div className="aspect-video overflow-hidden rounded-xl border border-brand-border bg-surface-container-high">
                    {/* eslint-disable-next-line @next/next/no-img-element -- signed URL from Supabase Storage, not an optimizable static/remote asset */}
                    <img
                      src={data.evidence[activePhoto]?.signedUrl}
                      alt={`Bukti foto ${activePhoto + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  {data.evidence.length > 1 ? (
                    <div className="grid grid-cols-4 gap-2">
                      {data.evidence.map((e, i) => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => setActivePhoto(i)}
                          className={`aspect-square overflow-hidden rounded-lg border-2 ${
                            i === activePhoto ? "border-brand-signal-cyan" : "border-transparent opacity-60 hover:opacity-100"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- signed URL, not optimizable */}
                          <img src={e.thumbnailSignedUrl ?? e.signedUrl} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-brand-border bg-surface-container-lowest text-on-surface-variant">
                  <FileText className="h-8 w-8" />
                </div>
              )}
            </div>

            {/* AI analysis */}
            <div className="rounded-xl border border-brand-border bg-surface-container-low p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-sans text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                  Analisis AI
                </span>
                {data.prediction?.topConfidence !== null && data.prediction?.topConfidence !== undefined ? (
                  <span className="font-mono text-xs font-bold text-brand-relief-teal">
                    Keyakinan {Math.round(data.prediction.topConfidence * 100)}%
                  </span>
                ) : null}
              </div>
              {data.prediction?.topSeverity ? (
                <div className="flex flex-col gap-2">
                  <SeverityBadge severity={data.prediction.topSeverity} />
                  {data.prediction.isAdvisoryOnly ? (
                    <p className="font-sans text-xs italic text-brand-caution-amber">
                      Hasil advisory-only — model belum memenuhi ambang keyakinan untuk klasifikasi otomatis.
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="font-sans text-sm italic text-on-surface-variant">Belum ada hasil analisis.</p>
              )}
            </div>

            {/* Reporter description */}
            <div>
              <p className="mb-1 font-sans text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                Deskripsi Pelapor
              </p>
              <p className="font-sans text-sm leading-relaxed text-on-surface">
                {data.report.description || "(Tidak ada deskripsi)"}
              </p>
            </div>

            {/* Location */}
            {data.location ? (
              <div>
                <p className="mb-2 font-sans text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                  Lokasi Kejadian
                </p>
                <div className="overflow-hidden rounded-xl border border-brand-border">
                  <MapPin
                    longitude={data.location.longitude}
                    latitude={data.location.latitude}
                    accuracyMeters={data.location.accuracyMeters}
                    heightClassName="h-40"
                  />
                </div>
                <p className="mt-1.5 font-mono text-xs text-on-surface-variant">
                  {data.location.latitude.toFixed(4)}° S, {data.location.longitude.toFixed(4)}° E
                  {data.location.manualAddress ? ` · ${data.location.manualAddress}` : ""}
                </p>
              </div>
            ) : null}

            <Link
              href={`/verifier/laporan/${reportId}`}
              className="text-center font-sans text-xs font-semibold text-brand-signal-cyan hover:underline"
            >
              Lihat Detail Lengkap →
            </Link>

            {/* Decision actions — only for reports actually awaiting a decision */}
            {DECIDABLE_STATUSES.has(data.report.status) ? (
              <div className="border-t border-brand-border pt-5">
                <DecisionPanel reportId={reportId} onDecided={onDecided} />
              </div>
            ) : null}
          </>
        )}
      </div>
    </aside>
  );
}
