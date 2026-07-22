"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TaskStatus } from "@mboyo/domain";
import { Button, Input, Textarea } from "@mboyo/ui";

export interface TaskDetailActionsProps {
  taskId: string;
  status: TaskStatus;
}

const NEXT_STATUS: Partial<Record<TaskStatus, { status: TaskStatus; label: string }[]>> = {
  assigned: [{ status: "acknowledged", label: "Konfirmasi Diterima" }],
  acknowledged: [{ status: "in_progress", label: "Mulai Kerjakan" }],
  in_progress: [
    { status: "blocked", label: "Tandai Terkendala" },
    { status: "completed", label: "Tandai Selesai" },
  ],
  blocked: [{ status: "in_progress", label: "Lanjutkan Kembali" }],
};

/**
 * Task detail's status-transition and assignment controls (BLOCK 24).
 * Status-advance buttons are intentionally always rendered regardless of
 * viewer role — transition_response_task_status() (the RPC) is the actual
 * authorization boundary (only the current assignee may advance a
 * non-cancel transition), so a non-assignee simply gets a 403 from the API
 * if they click one; this mirrors this block's status route using
 * requireApiActor rather than a role gate. Cancellation is Coordinator-only
 * and always requires a reason, matching STATE_MACHINES.md.
 */
export function TaskDetailActions({ taskId, status }: TaskDetailActionsProps) {
  const router = useRouter();
  const [assigneeProfileId, setAssigneeProfileId] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function postJson(url: string, body: unknown) {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as { ok: boolean; error?: { message: string } };
      if (!result.ok) {
        setError(result.error?.message ?? "Gagal memproses tindakan.");
        return;
      }
      router.refresh();
    } catch {
      setError("Gagal menghubungi server.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const nextTransitions = NEXT_STATUS[status] ?? [];
  const canCancel = status !== "completed" && status !== "cancelled";

  return (
    <div className="flex flex-col gap-4">
      {(status === "draft" || status === "assigned") ? (
        <div className="flex flex-col gap-2 rounded-md border border-brand-border p-3">
          <label className="font-sans text-xs font-semibold text-on-surface">
            {status === "draft" ? "Tugaskan Kepada" : "Tugaskan Ulang Kepada"} (Profile ID)
          </label>
          <div className="flex gap-2">
            <Input
              value={assigneeProfileId}
              onChange={(event) => setAssigneeProfileId(event.target.value)}
              placeholder="UUID profil penerima tugas"
            />
            <Button
              type="button"
              disabled={isSubmitting || assigneeProfileId.trim().length === 0}
              onClick={() => void postJson(`/api/command/tasks/${taskId}/assign`, { assigneeProfileId: assigneeProfileId.trim() })}
            >
              Tugaskan
            </Button>
          </div>
        </div>
      ) : null}

      {nextTransitions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {nextTransitions.map((transition) => (
            <Button
              key={transition.status}
              type="button"
              variant="secondary"
              disabled={isSubmitting}
              onClick={() => void postJson(`/api/command/tasks/${taskId}/status`, { newStatus: transition.status })}
            >
              {transition.label}
            </Button>
          ))}
        </div>
      ) : null}

      {canCancel ? (
        <div className="flex flex-col gap-2 rounded-md border border-brand-border p-3">
          <label className="font-sans text-xs font-semibold text-on-surface">Batalkan Tugas (wajib alasan)</label>
          <Textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Alasan pembatalan..." />
          <Button
            type="button"
            variant="critical"
            disabled={isSubmitting || cancelReason.trim().length === 0}
            onClick={() =>
              void postJson(`/api/command/tasks/${taskId}/status`, { newStatus: "cancelled", reason: cancelReason.trim() })
            }
          >
            Batalkan Tugas
          </Button>
        </div>
      ) : null}

      {error ? <p className="font-sans text-xs text-brand-critical-red">{error}</p> : null}
    </div>
  );
}
