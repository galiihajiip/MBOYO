"use client";

import { useRef, useState } from "react";
import { Button } from "@mboyo/ui";
import { assessPhotoQuality } from "../../../../../lib/reports/photo-quality";
import type { ReportDraft } from "../../../../../lib/reports/types";

export interface PhotoStepProps {
  draft: ReportDraft;
  setDraft: (updater: (current: ReportDraft) => ReportDraft) => void;
}

/**
 * Step 2 — Photo capture/gallery. The `capture="environment"` attribute
 * opens the device camera directly on mobile while still falling back to a
 * normal file picker (gallery) everywhere else — no separate "gallery"
 * button is needed since browsers already offer that choice in the same
 * picker. Works fully offline: this is a local file read, no network call.
 */
export function PhotoStep({ draft, setDraft }: PhotoStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);

  async function handleFile(file: File) {
    setProcessing(true);
    try {
      const previewUrl = URL.createObjectURL(file);
      const qualityWarning = await assessPhotoQuality(file);
      setDraft((current) => ({
        ...current,
        photo: {
          previewUrl,
          blob: file,
          mimeType: file.type,
          sizeBytes: file.size,
          qualityWarning,
        },
      }));
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="font-sans text-sm text-on-surface-variant">
        Ambil foto kondisi kerusakan, atau pilih foto dari galeri perangkat Anda.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label="Ambil atau pilih foto"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {draft.photo ? (
        <div className="flex flex-col gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview URL (URL.createObjectURL), not an optimizable remote/static image */}
          <img
            src={draft.photo.previewUrl}
            alt="Pratinjau foto laporan"
            className="w-full rounded-lg border border-brand-border object-cover"
          />
          <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
            Ambil Ulang Foto
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={processing}
          className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-border bg-surface-container-lowest p-6 text-center hover:bg-brand-mist"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-10 w-10 text-on-surface-variant">
            <rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <path d="M8 7l1.5-3h5L16 7" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <circle cx="12" cy="13.5" r="3.2" stroke="currentColor" strokeWidth="1.6" />
          </svg>
          <span className="font-sans text-sm font-semibold text-on-surface">
            {processing ? "Memproses foto..." : "Ambil Foto"}
          </span>
        </button>
      )}
    </div>
  );
}
