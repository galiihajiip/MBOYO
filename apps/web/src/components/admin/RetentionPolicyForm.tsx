"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Checkbox, Input } from "@mboyo/ui";

export interface RetentionPolicyFormProps {
  policyKey: string;
  title: string;
  days: number;
  enabled: boolean;
}

/**
 * One retention.* policy row's edit form (BLOCK 27) — same shape as
 * BLOCK 25's EscalationRuleForm. Saving writes the DECLARED policy value
 * only — no scheduled job reads this value yet (disclosed limitation,
 * see the migration's own comment), so this page is honest about being a
 * configuration record, not a working enforcement toggle.
 */
export function RetentionPolicyForm({ policyKey, title, days, enabled: initialEnabled }: RetentionPolicyFormProps) {
  const router = useRouter();
  const [daysValue, setDaysValue] = useState(String(days));
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    setSaved(false);
    try {
      const parsedDays = Number(daysValue);
      if (Number.isNaN(parsedDays) || parsedDays < 1) {
        setError("Jumlah hari harus berupa angka positif.");
        return;
      }

      const response = await fetch("/api/admin/retention/policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: policyKey, value: { enabled, days: parsedDays } }),
      });
      const body = (await response.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) {
        setError(body.error?.message ?? "Gagal menyimpan kebijakan retensi.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Gagal menghubungi server.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-brand-border bg-surface-container-lowest p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-sans text-sm font-bold text-on-surface">{title}</h3>
        <label className="flex items-center gap-2 font-sans text-sm text-on-surface">
          <Checkbox checked={enabled} onCheckedChange={setEnabled} aria-label={`Aktifkan ${title}`} />
          Aktif
        </label>
      </div>

      <div className="flex flex-col gap-1">
        <label className="font-sans text-xs font-semibold text-on-surface">Jumlah Hari</label>
        <Input type="number" value={daysValue} onChange={(event) => setDaysValue(event.target.value)} />
      </div>

      {error ? <p className="font-sans text-xs text-brand-critical-red">{error}</p> : null}
      {saved ? <p className="font-sans text-xs text-brand-safe-green">Tersimpan.</p> : null}

      <Button type="button" onClick={() => void handleSave()} disabled={isSaving} className="self-start">
        {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
      </Button>
    </div>
  );
}
