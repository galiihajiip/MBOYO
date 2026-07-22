"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Textarea } from "@mboyo/ui";

export interface CreateTaskFormProps {
  reportId?: string;
  incidentClusterId?: string;
}

/**
 * Response task creation form (BLOCK 24) — category, description, assignee
 * (a separate step via assignResponseTask after creation, since
 * create_response_task() only ever produces a draft task; assignment is a
 * distinct action per STATE_MACHINES.md), due time, resources. Priority is
 * deliberately NOT offered here beyond the default "unassigned" — critical
 * priority requires a reason and is set via the separate Prioritas
 * workflow (PriorityDialog), matching create_response_task()'s own
 * server-side rejection of a critical priority at creation time.
 */
export function CreateTaskForm({ reportId, incidentClusterId }: CreateTaskFormProps) {
  const router = useRouter();
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [resources, setResources] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !isSubmitting && category.trim().length > 0 && (reportId !== undefined || incidentClusterId !== undefined);

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/command/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId,
          incidentClusterId,
          category: category.trim(),
          description: description.trim().length > 0 ? description.trim() : undefined,
          dueAt: dueAt.length > 0 ? new Date(dueAt).toISOString() : undefined,
          resources: resources.trim().length > 0 ? resources.trim() : undefined,
        }),
      });
      const body = (await response.json()) as { ok: boolean; data?: { task: { id: string } }; error?: { message: string } };
      if (!body.ok || !body.data) {
        setError(body.error?.message ?? "Gagal membuat tugas respons.");
        return;
      }
      router.push(`/command/tugas/${body.data.task.id}`);
    } catch {
      setError("Gagal menghubungi server untuk membuat tugas respons.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (reportId === undefined && incidentClusterId === undefined) {
    return (
      <p className="font-sans text-sm text-brand-critical-red">
        Tugas harus dibuat dari sebuah laporan atau klaster — buka formulir ini melalui Peta Krisis, Prioritas, atau
        Semua Laporan.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-brand-border bg-surface-container-lowest p-4">
      <div className="flex flex-col gap-1">
        <label className="font-sans text-xs font-semibold text-on-surface">Kategori</label>
        <Input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Evakuasi, Distribusi Logistik, ..." />
      </div>

      <div className="flex flex-col gap-1">
        <label className="font-sans text-xs font-semibold text-on-surface">Deskripsi (opsional)</label>
        <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Detail tugas..." />
      </div>

      <div className="flex flex-col gap-1">
        <label className="font-sans text-xs font-semibold text-on-surface">Batas Waktu (opsional)</label>
        <Input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
      </div>

      <div className="flex flex-col gap-1">
        <label className="font-sans text-xs font-semibold text-on-surface">Sumber Daya (opsional)</label>
        <Textarea value={resources} onChange={(event) => setResources(event.target.value)} placeholder="Personel, peralatan, perbekalan..." />
      </div>

      {error ? <p className="font-sans text-xs text-brand-critical-red">{error}</p> : null}

      <Button type="button" onClick={() => void handleSubmit()} disabled={!canSubmit}>
        {isSubmitting ? "Membuat tugas..." : "Buat Tugas"}
      </Button>
    </div>
  );
}
