import { Checkbox } from "@mboyo/ui";
import { CURRENT_CONSENT_VERSIONS, type ReportDraft } from "../../../../../lib/reports/types";

export interface ConsentStepProps {
  draft: ReportDraft;
  setDraft: (updater: (current: ReportDraft) => ReportDraft) => void;
}

/**
 * Step 7 — Consent. Two separately versioned acknowledgements (data
 * processing, and GPS accuracy limitation) per this block's field spec
 * ("consent versions") — so a future policy-text change doesn't silently
 * reinterpret an already-recorded acceptance of an older version.
 */
export function ConsentStep({ draft, setDraft }: ConsentStepProps) {
  const dataProcessingAccepted = draft.consent.dataProcessingVersion === CURRENT_CONSENT_VERSIONS.dataProcessing;
  const accuracyAccepted = draft.consent.accuracyDisclosureVersion === CURRENT_CONSENT_VERSIONS.accuracyDisclosure;

  function toggle(field: "dataProcessing" | "accuracy", checked: boolean) {
    setDraft((current) => ({
      ...current,
      consent: {
        ...current.consent,
        dataProcessingVersion:
          field === "dataProcessing"
            ? checked
              ? CURRENT_CONSENT_VERSIONS.dataProcessing
              : null
            : current.consent.dataProcessingVersion,
        accuracyDisclosureVersion:
          field === "accuracy"
            ? checked
              ? CURRENT_CONSENT_VERSIONS.accuracyDisclosure
              : null
            : current.consent.accuracyDisclosureVersion,
        acceptedAtClient: new Date().toISOString(),
      },
    }));
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-start gap-3">
        <Checkbox
          checked={dataProcessingAccepted}
          onCheckedChange={(checked) => toggle("dataProcessing", checked === true)}
          aria-label="Setujui pemrosesan data"
        />
        <span className="font-sans text-sm text-on-surface">
          Saya memahami bahwa foto, lokasi, dan deskripsi yang saya kirimkan akan diproses untuk
          keperluan verifikasi dan koordinasi respons bencana, sesuai{" "}
          <a href="/privacy" target="_blank" className="font-semibold text-brand-signal-cyan hover:underline">
            Kebijakan Privasi
          </a>
          .
        </span>
      </label>

      <label className="flex items-start gap-3">
        <Checkbox
          checked={accuracyAccepted}
          onCheckedChange={(checked) => toggle("accuracy", checked === true)}
          aria-label="Setujui keterbatasan akurasi lokasi"
        />
        <span className="font-sans text-sm text-on-surface">
          Saya memahami bahwa lokasi GPS bersifat perkiraan dan dapat memiliki tingkat akurasi
          yang bervariasi, dan bahwa lokasi manual yang saya masukkan mungkin kurang presisi.
        </span>
      </label>
    </div>
  );
}
