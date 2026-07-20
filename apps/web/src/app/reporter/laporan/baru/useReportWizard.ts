"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReportRepository } from "../../../../lib/reports/use-report-repository";
import { createEmptyDraft, WIZARD_STEPS, type ReportDraft, type WizardStep } from "../../../../lib/reports/types";

const AUTOSAVE_DEBOUNCE_MS = 600;

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Owns the report wizard's draft state, autosave, and draft-restore-on-mount
 * behavior — the "no data loss" and "draft restored" UX requirements from
 * this block's prompt. Every mutation goes through setDraft(), which
 * schedules a debounced save via the OfflineReportRepository seam (BLOCK 13
 * swaps the real implementation in; this hook never talks to the mock
 * adapter directly by name).
 */
export function useReportWizard() {
  const repository = useReportRepository();
  const [draft, setDraftState] = useState<ReportDraft | null>(null);
  const [restored, setRestored] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore-on-mount: resume the most recent not-yet-submitted draft rather
  // than silently starting a fresh one, satisfying "draft restored."
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const existing = await repository.getLatestUnsubmittedDraft();
      if (cancelled) return;
      if (existing) {
        setDraftState(existing);
        setRestored(true);
      } else {
        const clientReportId = crypto.randomUUID();
        setDraftState(createEmptyDraft(clientReportId));
        setRestored(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Repository identity is stable for the component's lifetime (see
    // useReportRepository); intentionally run once on mount only.
  }, []);

  const persist = useCallback(
    (next: ReportDraft) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      setSaveState("saving");
      saveTimeoutRef.current = setTimeout(() => {
        void repository
          .saveDraft(next)
          .then(() => setSaveState("saved"))
          .catch(() => setSaveState("error"));
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [repository],
  );

  const setDraft = useCallback(
    (updater: (current: ReportDraft) => ReportDraft) => {
      setDraftState((current) => {
        if (!current) return current;
        const next = updater(current);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const goToStep = useCallback(
    (step: WizardStep) => {
      setDraft((current) => ({ ...current, currentStep: step }));
    },
    [setDraft],
  );

  const stepIndex = draft ? WIZARD_STEPS.indexOf(draft.currentStep) : 0;

  const goNext = useCallback(() => {
    const nextIndex = Math.min(stepIndex + 1, WIZARD_STEPS.length - 1);
    const nextStep = WIZARD_STEPS[nextIndex];
    if (nextStep) goToStep(nextStep);
  }, [stepIndex, goToStep]);

  const goBack = useCallback(() => {
    const prevIndex = Math.max(stepIndex - 1, 0);
    const prevStep = WIZARD_STEPS[prevIndex];
    if (prevStep) goToStep(prevStep);
  }, [stepIndex, goToStep]);

  const discardAndRestart = useCallback(async () => {
    if (!draft) return;
    await repository.deleteDraft(draft.clientReportId);
    const clientReportId = crypto.randomUUID();
    setDraftState(createEmptyDraft(clientReportId));
    setRestored(false);
  }, [draft, repository]);

  return useMemo(
    () => ({
      draft,
      restored,
      saveState,
      stepIndex,
      totalSteps: WIZARD_STEPS.length,
      setDraft,
      goToStep,
      goNext,
      goBack,
      discardAndRestart,
      repository,
    }),
    [draft, restored, saveState, stepIndex, setDraft, goToStep, goNext, goBack, discardAndRestart, repository],
  );
}
