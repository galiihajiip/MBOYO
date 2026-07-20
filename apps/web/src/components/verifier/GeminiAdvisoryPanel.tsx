"use client";

import { useState } from "react";
import type { GeminiAdvisoryResponse, GeminiImageDisclosureLevel } from "@mboyo/domain";
import { GEMINI_ADVISORY_UI_LABEL } from "@mboyo/domain";
import { Button, Badge, Checkbox } from "@mboyo/ui";

export interface GeminiAdvisoryPanelProps {
  reportId: string;
  initialAdvisories: GeminiAdvisoryResponse[];
  geminiConfigured: boolean;
}

/**
 * BLOCK 22 — the Gemini advisory panel. Per
 * docs/adr/0004-local-ml-primary-gemini-advisory.md: requesting an
 * advisory here is entirely additive and informational — it never
 * changes report status, never pre-fills or influences the Verifier's own
 * confirm/override/reject decision (that remains a completely separate
 * action elsewhere on this page), and is only ever triggered explicitly by
 * clicking the button below — never automatically on page load.
 *
 * The required label (docs/product/CONTENT_GUIDE.md) is rendered verbatim
 * as this panel's header, exported as a single constant
 * (GEMINI_ADVISORY_UI_LABEL) so no call site can paraphrase it.
 */
export function GeminiAdvisoryPanel({ reportId, initialAdvisories, geminiConfigured }: GeminiAdvisoryPanelProps) {
  const [advisories, setAdvisories] = useState<GeminiAdvisoryResponse[]>(initialAdvisories);
  const [imageDisclosureLevel, setImageDisclosureLevel] = useState<GeminiImageDisclosureLevel>("none");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [externalDisclosureAccepted, setExternalDisclosureAccepted] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiresImageConsent = imageDisclosureLevel !== "none";
  const canSubmit =
    !isRequesting && (!requiresImageConsent || (consentAccepted && externalDisclosureAccepted));

  async function handleRequest() {
    setIsRequesting(true);
    setError(null);
    try {
      const response = await fetch(`/api/verifier/reports/${reportId}/gemini-advisory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDisclosureLevel,
          consentAccepted: requiresImageConsent ? consentAccepted : true,
          externalDisclosureAccepted: requiresImageConsent ? externalDisclosureAccepted : true,
        }),
      });
      const body = (await response.json()) as {
        ok: boolean;
        data?: { advisory: GeminiAdvisoryResponse };
        error?: { message: string };
      };

      if (!body.ok || !body.data) {
        setError(body.error?.message ?? "Gagal meminta analisis tambahan eksternal.");
        return;
      }
      const advisory = body.data.advisory;
      setAdvisories((previous) => [advisory, ...previous]);
    } catch {
      setError("Gagal menghubungi layanan analisis tambahan eksternal.");
    } finally {
      setIsRequesting(false);
    }
  }

  if (!geminiConfigured) {
    return (
      <section className="flex flex-col gap-2 rounded-md border border-dashed border-brand-border p-4">
        <h2 className="font-sans text-sm font-bold text-on-surface-variant">{GEMINI_ADVISORY_UI_LABEL}</h2>
        <p className="font-sans text-xs text-on-surface-variant">
          Fitur ini belum diaktifkan pada sistem ini. Verifikasi laporan berjalan sepenuhnya tanpa fitur ini.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border border-brand-border bg-surface-container-lowest p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-sans text-sm font-bold text-brand-ink-navy">{GEMINI_ADVISORY_UI_LABEL}</h2>
        <Badge tone="info">Eksternal</Badge>
      </div>
      <p className="font-sans text-xs text-on-surface-variant">
        Analisis ini bersifat opsional dan hanya sebagai referensi tambahan — tidak menentukan atau menggantikan
        keputusan resmi Verifikator.
      </p>

      <fieldset className="flex flex-col gap-2">
        <legend className="font-sans text-xs font-semibold text-on-surface">Data yang dikirim</legend>
        {(
          [
            { value: "none", label: "Hanya ringkasan model lokal (tanpa foto)" },
            { value: "redacted_image", label: "Foto tersamar (resolusi rendah, buram)" },
            { value: "raw_image", label: "Foto asli (butuh persetujuan eksplisit)" },
          ] as const
        ).map((option) => (
          <label key={option.value} className="flex items-center gap-2 font-sans text-xs text-on-surface">
            <input
              type="radio"
              name="imageDisclosureLevel"
              value={option.value}
              checked={imageDisclosureLevel === option.value}
              onChange={() => setImageDisclosureLevel(option.value)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>

      {requiresImageConsent ? (
        <div className="flex flex-col gap-2 rounded-sm bg-surface-container p-3">
          <label className="flex items-center gap-2 font-sans text-xs text-on-surface">
            <Checkbox
              checked={consentAccepted}
              onCheckedChange={(checked) => setConsentAccepted(checked)}
              aria-label="Persetujuan penggunaan analisis eksternal"
            />
            Saya menyetujui penggunaan analisis eksternal untuk laporan ini.
          </label>
          <label className="flex items-center gap-2 font-sans text-xs text-on-surface">
            <Checkbox
              checked={externalDisclosureAccepted}
              onCheckedChange={(checked) => setExternalDisclosureAccepted(checked)}
              aria-label="Pengungkapan pengiriman data ke pihak eksternal"
            />
            Saya memahami data ini akan dikirim ke penyedia layanan eksternal (Gemini).
          </label>
        </div>
      ) : null}

      <Button onClick={() => void handleRequest()} disabled={!canSubmit} variant="secondary">
        {isRequesting ? "Meminta analisis..." : "Minta Analisis Tambahan Eksternal"}
      </Button>

      {error ? <p className="font-sans text-xs text-brand-critical-red">{error}</p> : null}

      <ul className="flex flex-col gap-3">
        {advisories.map((advisory) => (
          <li key={advisory.id} className="flex flex-col gap-1 rounded-sm border border-brand-border p-3">
            <div className="flex items-center justify-between gap-2">
              <Badge tone={advisory.status === "succeeded" ? "success" : "warning"}>
                {advisoryStatusLabel(advisory.status)}
              </Badge>
              <span className="font-mono text-xs text-on-surface-variant">
                {new Date(advisory.createdAt).toLocaleString("id-ID")}
              </span>
            </div>
            {advisory.structuredOutput ? (
              <div className="flex flex-col gap-1 font-sans text-xs text-on-surface">
                <p>{advisory.structuredOutput.evidenceSummary}</p>
                {advisory.structuredOutput.nonBindingHypothesis ? (
                  <p className="italic text-on-surface-variant">
                    Hipotesis non-final: {advisory.structuredOutput.nonBindingHypothesis}
                  </p>
                ) : null}
                {advisory.structuredOutput.suggestedFollowUpQuestion ? (
                  <p>Saran pertanyaan lanjutan: {advisory.structuredOutput.suggestedFollowUpQuestion}</p>
                ) : null}
                {advisory.structuredOutput.qualityObservations.length > 0 ? (
                  <ul className="list-inside list-disc text-on-surface-variant">
                    {advisory.structuredOutput.qualityObservations.map((observation, index) => (
                      <li key={index}>{observation}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <p className="font-sans text-xs text-brand-critical-red">{advisory.errorMessage}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function advisoryStatusLabel(status: GeminiAdvisoryResponse["status"]): string {
  switch (status) {
    case "succeeded":
      return "Berhasil";
    case "failed":
      return "Gagal";
    case "timed_out":
      return "Waktu habis";
    case "rate_limited":
      return "Dibatasi laju";
  }
}
