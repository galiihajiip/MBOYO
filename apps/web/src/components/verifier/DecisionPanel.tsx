"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SeverityClass, VerificationDecision, VerificationRejectReason } from "@mboyo/domain";
import { VERIFICATION_REJECT_REASONS } from "@mboyo/domain";
import { Button, Select, Textarea, severityLabels, rejectReasonLabels, verificationDecisionLabels } from "@mboyo/ui";

export interface DecisionPanelProps {
  reportId: string;
}

const SEVERITY_OPTIONS = (Object.keys(severityLabels) as SeverityClass[]).map((value) => ({
  value,
  label: severityLabels[value],
}));

const REJECT_REASON_OPTIONS = VERIFICATION_REJECT_REASONS.map((value) => ({
  value,
  label: rejectReasonLabels[value],
}));

const DECISION_ORDER: VerificationDecision[] = [
  "confirm",
  "override",
  "reject",
  "request_info",
  "insufficient_evidence",
  "escalate",
];

/**
 * The Verifier's decision action panel — this block's "Actions: Confirm,
 * Override with mandatory reason, Reject with reason category/note, Request
 * Information, Insufficient Evidence, Escalate Review" requirement. Renders
 * one action at a time (chosen via the buttons row) so each decision's
 * extra required fields (override severity, reject reason category, notes)
 * only ever appear for the decision they apply to — mirrors
 * submitVerificationDecisionSchema's (packages/domain) own conditional
 * requirements exactly, so a submission that passes this form's disabled-
 * button guard also passes that schema server-side.
 */
export function DecisionPanel({ reportId }: DecisionPanelProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<VerificationDecision | null>(null);
  const [overrideSeverity, setOverrideSeverity] = useState<SeverityClass | undefined>(undefined);
  const [rejectReasonCategory, setRejectReasonCategory] = useState<VerificationRejectReason | undefined>(undefined);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const notesRequired = selected === "override" || selected === "reject" || selected === "escalate";
  const canSubmit =
    selected !== null &&
    !isSubmitting &&
    (selected !== "override" || overrideSeverity !== undefined) &&
    (selected !== "reject" || rejectReasonCategory !== undefined) &&
    (!notesRequired || notes.trim().length > 0);

  function selectDecision(decision: VerificationDecision) {
    setSelected(decision);
    setOverrideSeverity(undefined);
    setRejectReasonCategory(undefined);
    setNotes("");
    setError(null);
  }

  async function handleSubmit() {
    if (!selected) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/reports/${reportId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: selected,
          overrideSeverity: selected === "override" ? overrideSeverity : undefined,
          rejectReasonCategory: selected === "reject" ? rejectReasonCategory : undefined,
          notes: notes.trim().length > 0 ? notes.trim() : undefined,
        }),
      });
      const body = (await response.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) {
        setError(body.error?.message ?? "Gagal menyimpan keputusan verifikasi.");
        return;
      }
      setSubmitted(true);
      router.refresh();
    } catch {
      setError("Gagal menghubungi server untuk menyimpan keputusan.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <section className="rounded-md border border-brand-safe-green bg-brand-safe-green/5 p-4">
        <p className="font-sans text-sm font-semibold text-on-surface">Keputusan berhasil disimpan.</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-md border border-brand-border bg-surface-container-lowest p-4">
      <h2 className="font-sans text-sm font-bold text-on-surface">Keputusan Verifikasi</h2>

      <div className="flex flex-wrap gap-2">
        {DECISION_ORDER.map((decision) => (
          <Button
            key={decision}
            type="button"
            variant={selected === decision ? "primary" : "ghost"}
            onClick={() => selectDecision(decision)}
          >
            {verificationDecisionLabels[decision]}
          </Button>
        ))}
      </div>

      {selected === "override" ? (
        <div className="flex flex-col gap-1">
          <label className="font-sans text-xs font-semibold text-on-surface">Klasifikasi Pengganti</label>
          <Select
            options={SEVERITY_OPTIONS}
            value={overrideSeverity}
            onValueChange={(value) => setOverrideSeverity(value as SeverityClass)}
            placeholder="Pilih klasifikasi..."
            aria-label="Klasifikasi Pengganti"
          />
        </div>
      ) : null}

      {selected === "reject" ? (
        <div className="flex flex-col gap-1">
          <label className="font-sans text-xs font-semibold text-on-surface">Kategori Alasan Penolakan</label>
          <Select
            options={REJECT_REASON_OPTIONS}
            value={rejectReasonCategory}
            onValueChange={(value) => setRejectReasonCategory(value as VerificationRejectReason)}
            placeholder="Pilih kategori..."
            aria-label="Kategori Alasan Penolakan"
          />
        </div>
      ) : null}

      {selected ? (
        <div className="flex flex-col gap-1">
          <label className="font-sans text-xs font-semibold text-on-surface">
            Catatan {notesRequired ? "(wajib)" : "(opsional)"}
          </label>
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Jelaskan alasan keputusan ini..."
          />
        </div>
      ) : null}

      {error ? <p className="font-sans text-xs text-brand-critical-red">{error}</p> : null}

      <Button type="button" onClick={() => void handleSubmit()} disabled={!canSubmit}>
        {isSubmitting ? "Menyimpan..." : "Simpan Keputusan"}
      </Button>
    </section>
  );
}
