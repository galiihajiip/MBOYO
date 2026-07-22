"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PriorityLevel } from "@mboyo/domain";
import { PRIORITY_LEVELS } from "@mboyo/domain";
import { Button, Dialog, Select, Textarea, priorityLabels } from "@mboyo/ui";

export interface PriorityDialogProps {
  trigger: React.ReactNode;
  title: string;
  currentPriority: PriorityLevel;
  /** POSTs { priority, reason } to this endpoint (a cluster's or a task's priority route). */
  endpoint: string;
}

const PRIORITY_OPTIONS = PRIORITY_LEVELS.map((priority) => ({ value: priority, label: priorityLabels[priority] }));

/**
 * The priority-setting workflow (this block's "Operational priority is
 * separate from model severity. Critical priority requires reason and
 * audit" requirement) — shared between incident_clusters and
 * response_tasks, since both use the identical setPrioritySchema shape and
 * the same set_*_priority() RPC pattern. The reason field only becomes
 * required (enforced by the button's disabled state, mirroring
 * setPrioritySchema's own refine rule) once "Kritis" is selected.
 */
export function PriorityDialog({ trigger, title, currentPriority, endpoint }: PriorityDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [priority, setPriority] = useState<PriorityLevel>(currentPriority);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reasonRequired = priority === "critical";
  const canSubmit = !isSubmitting && (!reasonRequired || reason.trim().length > 0);

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority, reason: reason.trim().length > 0 ? reason.trim() : undefined }),
      });
      const body = (await response.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) {
        setError(body.error?.message ?? "Gagal mengubah prioritas.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Gagal menghubungi server untuk mengubah prioritas.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen} trigger={trigger} title={title}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="font-sans text-xs font-semibold text-on-surface">Prioritas</label>
          <Select
            options={PRIORITY_OPTIONS}
            value={priority}
            onValueChange={(value) => setPriority(value as PriorityLevel)}
            aria-label="Prioritas"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-sans text-xs font-semibold text-on-surface">
            Alasan {reasonRequired ? "(wajib untuk prioritas kritis)" : "(opsional)"}
          </label>
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Jelaskan alasan perubahan prioritas..." />
        </div>

        {error ? <p className="font-sans text-xs text-brand-critical-red">{error}</p> : null}

        <Button type="button" onClick={() => void handleSubmit()} disabled={!canSubmit}>
          {isSubmitting ? "Menyimpan..." : "Simpan Prioritas"}
        </Button>
      </div>
    </Dialog>
  );
}
