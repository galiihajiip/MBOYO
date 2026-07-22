"use client";

import { useState } from "react";
import { Button, Select } from "@mboyo/ui";
import type { ExportFormat } from "@mboyo/domain";
import { EXPORT_FORMATS } from "@mboyo/domain";

export interface ExportFormProps {
  events: { id: string; name: string }[];
  /** POST target — /api/command/exports (Coordinator) or /api/audit/exports (Auditor compliance export). */
  endpoint?: string;
}

const FORMAT_OPTIONS = EXPORT_FORMATS.map((format) => ({ value: format, label: format.toUpperCase() }));

/**
 * Ekspor's request form (BLOCK 24, extended BLOCK 26 with the json format
 * and a configurable endpoint so Auditor's compliance-export screen can
 * reuse the exact same form) — POSTing here triggers REAL synchronous
 * CSV/GeoJSON/JSON generation (lib/command/exports.ts createExportJob),
 * not just a queued placeholder; the signed download URL appears
 * immediately on success, valid for 5 minutes (matching
 * createExportJob's SIGNED_URL_TTL_SECONDS).
 */
export function ExportForm({ events, endpoint = "/api/command/exports" }: ExportFormProps) {
  const [disasterEventId, setDisasterEventId] = useState(events[0]?.id ?? "");
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);
    setDownloadUrl(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disasterEventId, format }),
      });
      const body = (await response.json()) as {
        ok: boolean;
        data?: { job: { signedUrl: string | null } };
        error?: { message: string };
      };
      if (!body.ok || !body.data) {
        setError(body.error?.message ?? "Gagal membuat ekspor.");
        return;
      }
      setDownloadUrl(body.data.job.signedUrl);
    } catch {
      setError("Gagal menghubungi server untuk membuat ekspor.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (events.length === 0) {
    return <p className="font-sans text-sm text-on-surface-variant">Belum ada event bencana untuk diekspor.</p>;
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-brand-border bg-surface-container-lowest p-4">
      <div className="flex flex-col gap-1">
        <label className="font-sans text-xs font-semibold text-on-surface">Event Bencana</label>
        <Select
          options={events.map((event) => ({ value: event.id, label: event.name }))}
          value={disasterEventId}
          onValueChange={setDisasterEventId}
          aria-label="Event Bencana"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="font-sans text-xs font-semibold text-on-surface">Format</label>
        <Select
          options={FORMAT_OPTIONS}
          value={format}
          onValueChange={(value) => setFormat(value as ExportFormat)}
          aria-label="Format ekspor"
        />
      </div>

      {error ? <p className="font-sans text-xs text-brand-critical-red">{error}</p> : null}

      {downloadUrl ? (
        <a href={downloadUrl} className="font-sans text-sm font-semibold text-brand-deep-ocean underline" download>
          Unduh Berkas Ekspor
        </a>
      ) : null}

      <Button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting || !disasterEventId}>
        {isSubmitting ? "Membuat ekspor..." : "Buat Ekspor"}
      </Button>
    </div>
  );
}
