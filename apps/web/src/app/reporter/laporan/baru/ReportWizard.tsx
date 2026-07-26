"use client";

import { useReportWizard } from "./useReportWizard";
import { WizardShell } from "./WizardShell";
import { EventStep } from "./steps/EventStep";
import { PhotoStep } from "./steps/PhotoStep";
import { PreviewStep } from "./steps/PreviewStep";
import { GpsStep } from "./steps/GpsStep";
import { ManualLocationStep } from "./steps/ManualLocationStep";
import { DescriptionStep } from "./steps/DescriptionStep";
import { ConsentStep } from "./steps/ConsentStep";
import { ReviewStep } from "./steps/ReviewStep";
import { SubmitStep } from "./steps/SubmitStep";
import { CURRENT_CONSENT_VERSIONS, type WizardStep } from "../../../../lib/reports/types";
import { LoadingSkeleton } from "@mboyo/ui";

const STEP_TITLES: Record<WizardStep, string> = {
  event: "Pilih Event Bencana",
  photo: "Ambil Foto",
  preview: "Tinjau Foto",
  gps: "Tandai Lokasi (GPS)",
  manual_location: "Tandai Lokasi Manual",
  description: "Ceritakan Kejadiannya",
  consent: "Persetujuan",
  review: "Tinjau Laporan",
  submit: "Kirim Laporan",
};

function canAdvance(step: WizardStep, draft: ReturnType<typeof useReportWizard>["draft"]): boolean {
  if (!draft) return false;
  switch (step) {
    case "event":
      return draft.eventId !== null;
    case "photo":
      return draft.photo !== null;
    case "preview":
      return draft.photo !== null;
    case "gps":
      // GPS is optional — the manual-location step is the explicit fallback,
      // so this step alone never blocks continuing.
      return true;
    case "manual_location":
      return true;
    case "description":
      return draft.title.trim().length > 0 && draft.observedSeverity !== null;
    case "consent":
      return (
        draft.consent.dataProcessingVersion === CURRENT_CONSENT_VERSIONS.dataProcessing &&
        draft.consent.accuracyDisclosureVersion === CURRENT_CONSENT_VERSIONS.accuracyDisclosure
      );
    case "review":
      return true;
    case "submit":
      return true;
  }
}

/**
 * Orchestrates the 9-step report wizard per this block's spec: Event,
 * Photo, Preview, GPS, Manual location fallback, Description, Consent,
 * Review, Submit. The GPS step routes forward either to the next step
 * (description) directly, or to the manual-location fallback step if the
 * Reporter has no GPS location yet — matching "no data loss / never a dead
 * end" for GPS denial (docs/product/RISK_REGISTER.md risk #3).
 */
export function ReportWizard() {
  const { draft, restored, saveState, stepIndex, totalSteps, setDraft, goToStep, goNext, goBack, repository } =
    useReportWizard();

  if (!draft) {
    return (
      <div className="mx-auto max-w-2xl">
        <LoadingSkeleton lines={4} />
      </div>
    );
  }

  const step = draft.currentStep;

  function handleNext() {
    if (step === "gps") {
      // Skip the manual-location step entirely if GPS already succeeded.
      goToStep(draft?.location?.source === "gps" ? "description" : "manual_location");
      return;
    }
    goNext();
  }

  function handleBack() {
    if (step === "manual_location") {
      goToStep("gps");
      return;
    }
    goBack();
  }

  return (
    <div>
      {restored && step !== "submit" ? (
        <div className="mx-auto mb-4 max-w-2xl rounded-md border border-brand-signal-cyan/40 bg-brand-signal-cyan/10 p-3">
          <p className="font-sans text-sm text-brand-deep-ocean">
            Draf laporan sebelumnya berhasil dipulihkan — lanjutkan dari tempat Anda berhenti.
          </p>
        </div>
      ) : null}

      <WizardShell
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        saveState={saveState}
        title={STEP_TITLES[step]}
        draft={draft}
        onBack={stepIndex > 0 ? handleBack : undefined}
        onNext={step === "submit" ? undefined : handleNext}
        nextDisabled={!canAdvance(step, draft)}
        hideNext={step === "submit"}
      >
        {step === "event" ? <EventStep draft={draft} setDraft={setDraft} /> : null}
        {step === "photo" ? <PhotoStep draft={draft} setDraft={setDraft} /> : null}
        {step === "preview" ? <PreviewStep draft={draft} /> : null}
        {step === "gps" ? (
          <GpsStep draft={draft} setDraft={setDraft} onUseManualFallback={() => goToStep("manual_location")} />
        ) : null}
        {step === "manual_location" ? <ManualLocationStep draft={draft} setDraft={setDraft} /> : null}
        {step === "description" ? <DescriptionStep draft={draft} setDraft={setDraft} /> : null}
        {step === "consent" ? <ConsentStep draft={draft} setDraft={setDraft} /> : null}
        {step === "review" ? <ReviewStep draft={draft} /> : null}
        {step === "submit" ? <SubmitStep draft={draft} repository={repository} /> : null}
      </WizardShell>
    </div>
  );
}
