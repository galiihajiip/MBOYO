"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DisasterEventStatus } from "@mboyo/domain";
import { Button } from "@mboyo/ui";

export interface DisasterEventStatusToggleProps {
  eventId: string;
  status: DisasterEventStatus;
}

export function DisasterEventStatusToggle({ eventId, status }: DisasterEventStatusToggleProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setIsSubmitting(true);
    setError(null);
    try {
      const nextStatus: DisasterEventStatus = status === "active" ? "closed" : "active";
      const response = await fetch(`/api/admin/events/${eventId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const body = (await response.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) {
        setError(body.error?.message ?? "Gagal mengubah status kejadian bencana.");
        return;
      }
      router.refresh();
    } catch {
      setError("Gagal menghubungi server.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="ghost" onClick={() => void toggle()} disabled={isSubmitting}>
        {status === "active" ? "Selesaikan Kejadian" : "Aktifkan Kembali"}
      </Button>
      {error ? <p className="font-sans text-xs text-brand-critical-red">{error}</p> : null}
    </div>
  );
}
