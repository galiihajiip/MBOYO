"use client";

import { useEffect, useState } from "react";
import { Button } from "@mboyo/ui";

interface ConsentStatusDto {
  documentKey: string;
  currentVersion: string;
  needsConsent: boolean;
}

/**
 * Minimal accept-on-login consent flow (BLOCK 28). Checks GET /api/consent
 * once per mount; if the privacy_notice document's current version hasn't
 * been accepted yet, renders a blocking overlay (no dismiss/close action —
 * the only way past it is to accept) over whatever page is already
 * rendered underneath. This is intentionally minimal: one document, one
 * button, no granular per-purpose toggles — see PRIVACY_MODEL.md for what
 * a fuller consent-management UI would add and why it's out of this
 * block's scope.
 *
 * Fails open (renders nothing) on a network/fetch error rather than
 * blocking every page load if /api/consent is briefly unreachable — a
 * missing consent record is re-checked on the next navigation, so this
 * does not create a permanent bypass.
 */
export function ConsentGate() {
  const [pendingDocumentKey, setPendingDocumentKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetch("/api/consent")
      .then((response) => response.json())
      .then((body: { ok: boolean; data?: { statuses: ConsentStatusDto[] } }) => {
        if (cancelled || !body.ok || !body.data) return;
        const outstanding = body.data.statuses.find((status) => status.needsConsent);
        setPendingDocumentKey(outstanding?.documentKey ?? null);
      })
      .catch(() => {
        // Fail open — see module doc comment.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAccept() {
    if (!pendingDocumentKey) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentKey: pendingDocumentKey }),
      });
      const body = (await response.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) {
        setError(body.error?.message ?? "Gagal menyimpan persetujuan.");
        return;
      }
      setPendingDocumentKey(null);
    } catch {
      setError("Gagal menyimpan persetujuan. Periksa koneksi Anda dan coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!pendingDocumentKey) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-brand-border bg-surface-container-lowest p-6 shadow-lg">
        <h2 className="font-sans text-lg font-semibold text-on-surface">Pemberitahuan Privasi</h2>
        <p className="mt-2 font-sans text-sm text-on-surface-variant">
          MBOYO memproses laporan, foto, dan lokasi Anda untuk verifikasi bencana dan koordinasi respons. Sebagian
          foto dapat dianalisis oleh layanan AI pihak ketiga (Gemini) untuk membantu peninjauan. Data disimpan sesuai
          kebijakan retensi organisasi Anda. Dengan melanjutkan, Anda menyetujui pemberitahuan privasi ini.
        </p>
        {error ? <p className="mt-2 font-sans text-xs text-brand-critical-red">{error}</p> : null}
        <div className="mt-4 flex justify-end">
          <Button onClick={() => void handleAccept()} disabled={submitting}>
            {submitting ? "Menyimpan..." : "Saya Setuju"}
          </Button>
        </div>
      </div>
    </div>
  );
}
