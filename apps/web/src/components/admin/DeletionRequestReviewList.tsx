"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, EmptyState } from "@mboyo/ui";

export interface DeletionRequestItem {
  id: string;
  requestedByProfileId: string;
  subjectReportId: string | null;
  reason: string;
  status: "pending" | "approved" | "denied" | "completed";
  createdAt: string;
}

const STATUS_TONE: Record<DeletionRequestItem["status"], "neutral" | "success" | "critical" | "info"> = {
  pending: "info",
  approved: "success",
  denied: "critical",
  completed: "neutral",
};

/**
 * Admin's deletion-request review queue (BLOCK 27 placeholder workflow) —
 * approve/deny/mark-completed via review_deletion_request(), always
 * audited. Deliberately does NOT itself delete anything on "approved" or
 * "completed" — no such execution mechanism exists (disclosed limitation,
 * see supabase/migrations/20260726070002_retention_placeholders.sql).
 */
export function DeletionRequestReviewList({ requests: initialRequests }: { requests: DeletionRequestItem[] }) {
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests);
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function review(id: string, status: "approved" | "denied" | "completed") {
    setIsSubmitting(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/retention/deletion-requests/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = (await response.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) {
        setError(body.error?.message ?? "Gagal meninjau permintaan.");
        return;
      }
      setRequests((current) => current.map((r) => (r.id === id ? { ...r, status } : r)));
      router.refresh();
    } catch {
      setError("Gagal menghubungi server.");
    } finally {
      setIsSubmitting(null);
    }
  }

  if (requests.length === 0) {
    return <EmptyState title="Tidak ada permintaan penghapusan" description="Permintaan penghapusan data akan muncul di sini." />;
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? <p className="font-sans text-xs text-brand-critical-red">{error}</p> : null}
      <ul className="flex flex-col gap-2">
        {requests.map((request) => (
          <li key={request.id} className="flex flex-col gap-2 rounded-md border border-brand-border bg-surface-container-lowest p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge tone={STATUS_TONE[request.status]}>{request.status}</Badge>
              <span className="font-mono text-xs text-on-surface-variant">
                {new Date(request.createdAt).toLocaleString("id-ID")}
              </span>
            </div>
            <p className="font-sans text-sm text-on-surface">{request.reason}</p>
            {request.status === "pending" ? (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isSubmitting === request.id}
                  onClick={() => void review(request.id, "approved")}
                >
                  Setujui
                </Button>
                <Button
                  type="button"
                  variant="critical"
                  disabled={isSubmitting === request.id}
                  onClick={() => void review(request.id, "denied")}
                >
                  Tolak
                </Button>
              </div>
            ) : request.status === "approved" ? (
              <Button
                type="button"
                variant="ghost"
                disabled={isSubmitting === request.id}
                onClick={() => void review(request.id, "completed")}
              >
                Tandai Selesai
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
