"use client";

import type { ReactNode } from "react";
import {
  Button,
  SeverityBadge,
  ArrowLeft,
  ArrowRight,
  MapPinIcon,
  ShieldCheck,
  FileText,
} from "@mboyo/ui";
import type { SaveState } from "./useReportWizard";
import type { ReportDraft } from "../../../../lib/reports/types";

export interface WizardShellProps {
  stepIndex: number;
  totalSteps: number;
  saveState: SaveState;
  title: string;
  draft: ReportDraft;
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  hideNext?: boolean;
}

const SAVE_STATE_LABEL: Record<SaveState, string> = {
  idle: "",
  saving: "Menyimpan...",
  saved: "Tersimpan di perangkat",
  error: "Gagal menyimpan — akan dicoba lagi",
};

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-sans text-[11px] font-bold uppercase tracking-wider text-white/50">{label}</p>
      {children}
    </div>
  );
}

/**
 * Sticky "Ringkasan Laporan" summary panel — read-only reflection of the
 * current ReportDraft, visible across every wizard step (not just the
 * location step) so the Reporter always sees what they've committed so
 * far. Deliberately shows "Belum ditentukan..." for fields not yet filled
 * rather than omitting them, matching the "no data loss / always visible
 * progress" wizard requirement.
 */
function SummaryPanel({ draft }: { draft: ReportDraft }) {
  return (
    <aside className="hidden w-[320px] shrink-0 lg:block">
      <div className="sticky top-20 flex flex-col gap-5 rounded-2xl bg-brand-ink-navy p-6 text-white shadow-xl">
        <div className="flex items-center justify-between border-b border-white/15 pb-3">
          <h2 className="font-sans text-base font-bold">Ringkasan Laporan</h2>
          <FileText className="h-5 w-5 text-brand-signal-cyan" />
        </div>

        <SummaryRow label="Event Bencana">
          {draft.eventName ? (
            <p className="font-sans text-sm font-bold">{draft.eventName}</p>
          ) : (
            <p className="font-sans text-sm italic text-white/40">Belum ditentukan...</p>
          )}
        </SummaryRow>

        <SummaryRow label="Lokasi Terpilih">
          {draft.location ? (
            <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/10 p-3">
              <div className="flex items-start gap-2">
                <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-signal-cyan" />
                <p className="font-sans text-sm leading-snug">
                  {draft.location.manualAddress || "Koordinat GPS tercatat"}
                </p>
              </div>
              <div className="flex justify-between rounded bg-black/20 px-2 py-1.5 font-mono text-xs text-brand-signal-cyan">
                <span>LAT: {draft.location.latitude.toFixed(4)}</span>
                <span>LON: {draft.location.longitude.toFixed(4)}</span>
              </div>
            </div>
          ) : (
            <p className="font-sans text-sm italic text-white/40">Belum ditentukan...</p>
          )}
        </SummaryRow>

        <SummaryRow label="Detail Kerusakan">
          {draft.title || draft.observedSeverity ? (
            <div className="flex flex-col gap-1.5">
              {draft.title ? <p className="font-sans text-sm font-semibold">{draft.title}</p> : null}
              {draft.observedSeverity ? <SeverityBadge severity={draft.observedSeverity} /> : null}
            </div>
          ) : (
            <p className="font-sans text-sm italic text-white/40">Belum ditentukan...</p>
          )}
        </SummaryRow>

        <SummaryRow label="Media Pendukung">
          <p className="font-sans text-sm">{draft.photo ? "1 Foto" : "0 Foto"}</p>
        </SummaryRow>

        <div className="flex items-start gap-3 rounded-lg bg-brand-relief-teal p-3">
          <ShieldCheck className="h-5 w-5 shrink-0 text-brand-night" />
          <p className="font-sans text-xs font-medium text-brand-night">
            Laporan Anda tersimpan aman di perangkat dan akan terkirim otomatis begitu koneksi
            tersedia.
          </p>
        </div>
      </div>
    </aside>
  );
}

/**
 * Shared wizard chrome: step progress indicator, save-state indicator (so
 * the Reporter always sees their input is safe — "no data loss" per this
 * block's UX requirements), a sticky bottom action bar on mobile (per
 * docs/product/SCREEN_INVENTORY.md's mobile responsive hierarchy for Buat
 * Laporan: "persistent bottom action bar"), and a desktop-only sticky
 * summary panel reflecting the draft's current state at every step.
 */
export function WizardShell({
  stepIndex,
  totalSteps,
  saveState,
  title,
  draft,
  children,
  onBack,
  onNext,
  nextLabel = "Lanjut",
  nextDisabled,
  hideNext,
}: WizardShellProps) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 pb-24 sm:pb-6 lg:flex-row lg:items-start">
      <div className="flex-1 rounded-2xl border border-brand-border bg-surface-container-lowest p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-sans text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Langkah {stepIndex + 1} dari {totalSteps}
            </p>
            <h1 className="mt-1 font-sans text-xl font-bold text-on-surface sm:text-2xl">{title}</h1>
          </div>
          <p role="status" aria-live="polite" className="shrink-0 font-sans text-xs text-on-surface-variant">
            {SAVE_STATE_LABEL[saveState]}
          </p>
        </div>
        <div className="mt-4 flex gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i <= stepIndex ? "bg-brand-ink-navy" : "bg-surface-container-high"}`}
            />
          ))}
        </div>

        <div className="mt-6">{children}</div>

        <div className="fixed inset-x-0 bottom-0 z-30 flex gap-3 border-t border-brand-border bg-surface-container-lowest p-3 sm:static sm:mt-8 sm:justify-between sm:border-0 sm:bg-transparent sm:p-0">
          {onBack ? (
            <Button type="button" variant="ghost" onClick={onBack} className="flex-1 gap-2 sm:flex-none">
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Button>
          ) : (
            <span />
          )}
          {!hideNext && onNext ? (
            <Button type="button" onClick={onNext} disabled={nextDisabled} className="flex-1 gap-2 sm:flex-none">
              {nextLabel}
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      <SummaryPanel draft={draft} />
    </div>
  );
}
