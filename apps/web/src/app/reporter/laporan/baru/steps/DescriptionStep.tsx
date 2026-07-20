import { Input, Textarea, Select, SeverityBadge } from "@mboyo/ui";
import { SEVERITY_CLASSES, type SeverityClass } from "@mboyo/domain";
import type { ContactPreference, ReportDraft } from "../../../../../lib/reports/types";

export interface DescriptionStepProps {
  draft: ReportDraft;
  setDraft: (updater: (current: ReportDraft) => ReportDraft) => void;
}

const CONTACT_PREFERENCE_OPTIONS: { value: ContactPreference; label: string }[] = [
  { value: "telepon", label: "Telepon" },
  { value: "email", label: "Email" },
  { value: "tidak_perlu_dihubungi", label: "Tidak perlu dihubungi" },
];

/**
 * Step 6 — Description and observed condition. "Observed severity" here is
 * the Reporter's own honest impression, explicitly distinct from any later
 * AI/Verifier classification — labeled as such so it's never confused with
 * model_prediction.severity_probabilities (docs/product/DOMAIN_MODEL.md).
 */
export function DescriptionStep({ draft, setDraft }: DescriptionStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="font-sans text-sm font-medium text-on-surface">Judul Singkat</span>
        <Input
          placeholder="Contoh: Rumah roboh sebagian di RW 04"
          value={draft.title}
          onChange={(e) => setDraft((current) => ({ ...current, title: e.target.value }))}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-sans text-sm font-medium text-on-surface">Deskripsi Kejadian</span>
        <Textarea
          placeholder="Jelaskan apa yang Anda lihat sejelas mungkin..."
          value={draft.description}
          onChange={(e) => setDraft((current) => ({ ...current, description: e.target.value }))}
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="font-sans text-sm font-medium text-on-surface">
          Perkiraan Tingkat Kerusakan (menurut Anda)
        </span>
        <p className="font-sans text-xs text-on-surface-variant">
          Ini adalah perkiraan awal Anda sebagai pelapor — keputusan akhir tetap dilakukan oleh
          Verifikator setelah meninjau bukti.
        </p>
        <div className="flex flex-wrap gap-2">
          {SEVERITY_CLASSES.filter((s): s is Exclude<SeverityClass, "unknown"> => s !== "unknown").map(
            (severity) => (
              <button
                key={severity}
                type="button"
                onClick={() => setDraft((current) => ({ ...current, observedSeverity: severity }))}
                aria-pressed={draft.observedSeverity === severity}
                className="min-h-11 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand-signal-cyan"
              >
                <SeverityBadge
                  severity={severity}
                  className={
                    draft.observedSeverity === severity
                      ? "ring-2 ring-offset-1 ring-brand-ink-navy"
                      : "opacity-60"
                  }
                />
              </button>
            ),
          )}
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className="font-sans text-sm font-medium text-on-surface">Preferensi Dihubungi</span>
        <Select
          aria-label="Preferensi dihubungi"
          value={draft.contactPreference}
          onValueChange={(value) =>
            setDraft((current) => ({ ...current, contactPreference: value as ContactPreference }))
          }
          options={CONTACT_PREFERENCE_OPTIONS}
        />
      </label>
    </div>
  );
}
