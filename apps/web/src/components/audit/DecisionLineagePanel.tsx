"use client";

import { useState } from "react";
import { Button, Timeline, type TimelineEvent } from "@mboyo/ui";

export interface DecisionLineageEntry {
  reviewId: string;
  reportId: string;
  verifierProfileId: string;
  decision: string;
  decidedAt: string;
  supersedesReviewId: string | null;
}

export interface DecisionLineagePanelProps {
  reportId: string;
}

/**
 * Auditor's decision-lineage viewer (BLOCK 26) — fetches
 * verification_reviews history for one report on demand (not on page
 * load for every row, to keep /audit/laporan's initial list cheap), and
 * renders it as a Timeline including the supersedes_review_id chain. Zero
 * action affordances anywhere — per "Auditor exposes no mutation route,"
 * this component only ever calls GET.
 */
export function DecisionLineagePanel({ reportId }: DecisionLineagePanelProps) {
  const [lineage, setLineage] = useState<DecisionLineageEntry[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadLineage() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/audit/lineage/${reportId}`);
      const body = (await response.json()) as { ok: boolean; data?: { lineage: DecisionLineageEntry[] }; error?: { message: string } };
      if (!body.ok || !body.data) {
        setError(body.error?.message ?? "Gagal memuat riwayat keputusan.");
        return;
      }
      setLineage(body.data.lineage);
    } catch {
      setError("Gagal menghubungi server untuk memuat riwayat keputusan.");
    } finally {
      setIsLoading(false);
    }
  }

  if (lineage === null) {
    return (
      <Button variant="ghost" onClick={() => void loadLineage()} disabled={isLoading}>
        {isLoading ? "Memuat..." : "Lihat Riwayat Keputusan"}
      </Button>
    );
  }

  if (error) {
    return <p className="font-sans text-xs text-brand-critical-red">{error}</p>;
  }

  if (lineage.length === 0) {
    return <p className="font-sans text-sm text-on-surface-variant">Belum ada keputusan verifikasi untuk laporan ini.</p>;
  }

  const events: TimelineEvent[] = lineage.map((entry) => ({
    id: entry.reviewId,
    title: entry.decision,
    timestamp: new Date(entry.decidedAt).toLocaleString("id-ID"),
    actor: `Verifikator: ${entry.verifierProfileId}`,
    description: entry.supersedesReviewId ? `Menggantikan keputusan sebelumnya (${entry.supersedesReviewId}).` : undefined,
  }));

  return <Timeline events={events} />;
}
