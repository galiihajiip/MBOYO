import { QUALITY_WARNING_MESSAGE } from "../../../../../lib/reports/photo-quality";
import type { ReportDraft } from "../../../../../lib/reports/types";

export interface PreviewStepProps {
  draft: ReportDraft;
}

/**
 * Step 3 — Preview and quality feedback. Shows the heuristic quality
 * warning (if any) from PhotoStep, but never blocks continuing — a
 * low-quality photo is still a valid submission, per
 * docs/product/MVP_SCOPE.md and docs/product/RISK_REGISTER.md risk #4.
 */
export function PreviewStep({ draft }: PreviewStepProps) {
  if (!draft.photo) {
    return (
      <p className="font-sans text-sm text-brand-critical-red">
        Belum ada foto. Kembali ke langkah sebelumnya untuk mengambil foto.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview URL (URL.createObjectURL), not an optimizable remote/static image */}
      <img
        src={draft.photo.previewUrl}
        alt="Pratinjau foto laporan"
        className="w-full rounded-lg border border-brand-border object-cover"
      />

      {draft.photo.qualityWarning ? (
        <div className="rounded-md border border-brand-caution-amber/40 bg-brand-caution-amber/10 p-3">
          <p className="font-sans text-sm text-[#7a5109]">
            {QUALITY_WARNING_MESSAGE[draft.photo.qualityWarning]}
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-brand-safe-green/40 bg-brand-safe-green/10 p-3">
          <p className="font-sans text-sm text-[#1c7a48]">Kualitas foto tampak baik.</p>
        </div>
      )}
    </div>
  );
}
