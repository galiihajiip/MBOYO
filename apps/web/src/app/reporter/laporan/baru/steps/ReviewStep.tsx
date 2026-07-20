import { SeverityBadge } from "@mboyo/ui";
import type { ReportDraft } from "../../../../../lib/reports/types";

export interface ReviewStepProps {
  draft: ReportDraft;
}

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-brand-border py-3 last:border-b-0">
      <span className="font-sans text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
        {label}
      </span>
      <span className="font-sans text-sm text-on-surface">{value}</span>
    </div>
  );
}

/** Step 8 — Review. Read-only summary of everything the Reporter is about to submit, before the final action. */
export function ReviewStep({ draft }: ReviewStepProps) {
  const location = draft.location;

  return (
    <div className="rounded-lg border border-brand-border bg-surface-container-lowest px-4">
      {draft.photo ? (
        <div className="py-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview URL (URL.createObjectURL), not an optimizable remote/static image */}
          <img
            src={draft.photo.previewUrl}
            alt="Pratinjau foto laporan"
            className="w-full rounded-md border border-brand-border object-cover"
          />
        </div>
      ) : null}
      <ReviewRow label="Event" value={draft.eventName ?? "Belum dipilih"} />
      <ReviewRow label="Judul" value={draft.title || "(tanpa judul)"} />
      <ReviewRow label="Deskripsi" value={draft.description || "(tanpa deskripsi)"} />
      <ReviewRow
        label="Perkiraan Tingkat Kerusakan"
        value={draft.observedSeverity ? <SeverityBadge severity={draft.observedSeverity} /> : "Belum dipilih"}
      />
      <ReviewRow
        label="Lokasi"
        value={
          location
            ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)} (${
                location.source === "gps" ? "GPS" : location.source === "manual_pin" ? "Peta manual" : "Alamat manual"
              })`
            : "Belum ditentukan"
        }
      />
      <ReviewRow
        label="Preferensi Dihubungi"
        value={
          draft.contactPreference === "telepon"
            ? "Telepon"
            : draft.contactPreference === "email"
              ? "Email"
              : "Tidak perlu dihubungi"
        }
      />
    </div>
  );
}
