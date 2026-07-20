"use client";

import type { ReactNode } from "react";
import { Button } from "@mboyo/ui";
import type { SaveState } from "./useReportWizard";

export interface WizardShellProps {
  stepIndex: number;
  totalSteps: number;
  saveState: SaveState;
  title: string;
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

/**
 * Shared wizard chrome: step progress indicator, save-state indicator (so
 * the Reporter always sees their input is safe — "no data loss" per this
 * block's UX requirements), and a sticky bottom action bar on mobile
 * (per docs/product/SCREEN_INVENTORY.md's mobile responsive hierarchy for
 * Buat Laporan: "persistent bottom action bar").
 */
export function WizardShell({
  stepIndex,
  totalSteps,
  saveState,
  title,
  children,
  onBack,
  onNext,
  nextLabel = "Lanjut",
  nextDisabled,
  hideNext,
}: WizardShellProps) {
  const progressPercent = Math.round(((stepIndex + 1) / totalSteps) * 100);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-24 sm:pb-6">
      <div>
        <div className="flex items-center justify-between">
          <p className="font-sans text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Langkah {stepIndex + 1} dari {totalSteps}
          </p>
          <p
            role="status"
            aria-live="polite"
            className="font-sans text-xs text-on-surface-variant"
          >
            {SAVE_STATE_LABEL[saveState]}
          </p>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
          <div
            className="h-full rounded-full bg-brand-ink-navy transition-[width]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <h1 className="mt-4 font-sans text-xl font-bold text-on-surface sm:text-2xl">{title}</h1>
      </div>

      <div>{children}</div>

      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-3 border-t border-brand-border bg-surface-container-lowest p-3 sm:static sm:border-0 sm:bg-transparent sm:p-0">
        {onBack ? (
          <Button type="button" variant="ghost" onClick={onBack} className="flex-1 sm:flex-none">
            Kembali
          </Button>
        ) : null}
        {!hideNext && onNext ? (
          <Button
            type="button"
            onClick={onNext}
            disabled={nextDisabled}
            className="flex-1 sm:flex-none"
          >
            {nextLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
