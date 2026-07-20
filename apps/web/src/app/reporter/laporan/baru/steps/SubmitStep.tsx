"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, SyncStatus } from "@mboyo/ui";
import type { OfflineReportRepository } from "../../../../../lib/reports/repository";
import type { ReportDraft } from "../../../../../lib/reports/types";

export interface SubmitStepProps {
  draft: ReportDraft;
  repository: OfflineReportRepository;
}

/**
 * Step 9 — Submit or save offline. Per this block's "no data loss"
 * requirement: submitting always writes locally first (via
 * repository.submitDraft, backed by the real Dexie/IndexedDB queue per
 * lib/offline/dexie-report-repository.ts) and the Reporter is told plainly
 * whether they're online or offline; a failure never discards the draft.
 */
export function SubmitStep({ draft, repository }: SubmitStepProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [online, setOnline] = useState(true);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    setOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    try {
      const result = await repository.submitDraft(draft);
      if (result.ok) {
        setDone(true);
      } else {
        setError(result.error ?? "Laporan tidak dapat dikirim saat ini, namun tetap tersimpan di perangkat Anda.");
      }
    } catch {
      setError("Laporan tidak dapat dikirim saat ini, namun tetap tersimpan di perangkat Anda.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-brand-safe-green/40 bg-brand-safe-green/10 p-6 text-center">
        <p className="font-sans text-base font-semibold text-on-surface">Laporan berhasil dikirim</p>
        <p className="font-sans text-sm text-on-surface-variant">
          Terima kasih. Laporan Anda telah tersimpan dan akan segera diproses.
        </p>
        <Button type="button" onClick={() => router.push("/reporter/laporan")}>
          Lihat Laporan Saya
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <SyncStatus state={online ? "syncing" : "queued"} pendingCount={online ? undefined : 1} />
      </div>

      <p className="font-sans text-sm text-on-surface-variant">
        Laporan akan tersimpan di perangkat Anda terlebih dahulu. Jika Anda sedang offline,
        laporan akan otomatis dikirim begitu koneksi tersedia kembali — tidak akan hilang.
      </p>

      {error ? (
        <p role="alert" className="font-sans text-sm text-brand-critical-red">
          {error}
        </p>
      ) : null}

      <Button type="button" onClick={() => void handleSubmit()} disabled={submitting}>
        {submitting ? "Mengirim..." : "Kirim Laporan"}
      </Button>
    </div>
  );
}
