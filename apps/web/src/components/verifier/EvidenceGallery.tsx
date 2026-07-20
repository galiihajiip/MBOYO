"use client";

import { useState } from "react";
import Image from "next/image";
import { Badge, Dialog } from "@mboyo/ui";
import type { EvidenceDto } from "../../lib/reports/service/evidence";

export interface EvidenceGalleryProps {
  evidence: EvidenceDto[];
}

/**
 * Private evidence viewer for the Verifier detail page — this block's
 * "private evidence, zoom, quality, duplicate links" requirement. Every
 * image URL here is a short-lived signed URL generated server-side by
 * lib/reports/service/evidence.ts for THIS request only (never a public
 * bucket URL), matching docs/security/THREAT_MODEL.md threat #5. Zoom opens
 * the full-resolution signed image (not the thumbnail) in a Dialog.
 */
export function EvidenceGallery({ evidence }: EvidenceGalleryProps) {
  const [zoomed, setZoomed] = useState<EvidenceDto | null>(null);

  if (evidence.length === 0) {
    return (
      <p className="font-sans text-sm text-on-surface-variant">Belum ada bukti foto untuk laporan ini.</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {evidence.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setZoomed(item)}
            className="group relative flex aspect-square items-center justify-center overflow-hidden rounded-md border border-brand-border bg-surface-container-lowest"
          >
            <Image
              src={item.thumbnailSignedUrl ?? item.signedUrl}
              alt="Bukti foto laporan"
              fill
              sizes="200px"
              unoptimized
              className="object-cover transition group-hover:opacity-90"
            />
            {item.isDuplicateHash ? (
              <span className="absolute left-1 top-1">
                <Badge tone="warning">Duplikat</Badge>
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <Dialog
        open={zoomed !== null}
        onOpenChange={(open) => {
          if (!open) setZoomed(null);
        }}
        title="Bukti Foto"
        description={zoomed ? `${zoomed.widthPx ?? "?"}×${zoomed.heightPx ?? "?"}px · ${formatBytes(zoomed.sizeBytes)}` : undefined}
        className="w-[min(95vw,48rem)]"
      >
        {zoomed ? (
          <div className="relative h-[70vh] w-full">
            <Image
              src={zoomed.signedUrl}
              alt="Bukti foto laporan (perbesar)"
              fill
              sizes="90vw"
              unoptimized
              className="object-contain"
            />
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
