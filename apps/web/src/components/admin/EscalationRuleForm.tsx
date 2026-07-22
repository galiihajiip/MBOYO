"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EscalationRuleType, NotificationLevel } from "@mboyo/domain";
import { NOTIFICATION_LEVELS } from "@mboyo/domain";
import { Button, Checkbox, Input, Select } from "@mboyo/ui";

export interface EscalationRuleFormProps {
  ruleType: EscalationRuleType;
  title: string;
  description: string;
  value: Record<string, unknown>;
}

const LEVEL_OPTIONS = NOTIFICATION_LEVELS.map((level) => ({ value: level, label: level }));

/** Numeric threshold fields per rule, in display order — every rule always has `enabled` + `level`, this lists the rest. */
const NUMERIC_FIELDS: Record<EscalationRuleType, { key: string; label: string; step?: string }[]> = {
  verified_destroyed_threshold: [{ key: "minProbability", label: "Probabilitas minimum (0-1)", step: "0.01" }],
  cluster_destroyed_radius: [
    { key: "minCount", label: "Jumlah laporan minimum" },
    { key: "radiusMeters", label: "Radius (meter)" },
    { key: "windowHours", label: "Jendela waktu (jam)" },
  ],
  verifier_sla_breach: [{ key: "hoursSinceSubmission", label: "Jam sejak pengiriman" }],
  task_overdue: [],
  repeated_duplicate_source: [
    { key: "minCount", label: "Jumlah laporan duplikat minimum" },
    { key: "windowHours", label: "Jendela waktu (jam)" },
  ],
  repeated_analysis_failure: [
    { key: "minFailures", label: "Jumlah kegagalan minimum" },
    { key: "windowHours", label: "Jendela waktu (jam)" },
  ],
};

/**
 * One escalation rule's edit form (BLOCK 25) — reads/writes exactly the
 * shape escalationSettingSchemas[ruleType] (packages/domain) validates
 * server-side, so a submission that passes this form's own guard also
 * passes that schema. Saving calls PUT /api/admin/escalation-settings,
 * which writes straight to the escalation.* system_settings row —
 * evaluate_escalations() re-reads that row live on its very next call, so
 * this change takes effect without any restart (this block's explicit
 * acceptance criterion).
 */
export function EscalationRuleForm({ ruleType, title, description, value }: EscalationRuleFormProps) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(Boolean(value.enabled));
  const [level, setLevel] = useState<NotificationLevel>((value.level as NotificationLevel) ?? "warning");
  const [numericValues, setNumericValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const field of NUMERIC_FIELDS[ruleType]) {
      initial[field.key] = value[field.key] !== undefined ? String(value[field.key]) : "";
    }
    return initial;
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    setSaved(false);
    try {
      const numericPayload: Record<string, number> = {};
      for (const field of NUMERIC_FIELDS[ruleType]) {
        const parsed = Number(numericValues[field.key]);
        if (Number.isNaN(parsed)) {
          setError(`${field.label} harus berupa angka.`);
          setIsSaving(false);
          return;
        }
        numericPayload[field.key] = parsed;
      }

      const response = await fetch("/api/admin/escalation-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleType, value: { enabled, level, ...numericPayload } }),
      });
      const body = (await response.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) {
        setError(body.error?.message ?? "Gagal menyimpan aturan eskalasi.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Gagal menghubungi server untuk menyimpan aturan eskalasi.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-brand-border bg-surface-container-lowest p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-sans text-sm font-bold text-on-surface">{title}</h3>
          <p className="font-sans text-xs text-on-surface-variant">{description}</p>
        </div>
        <label className="flex shrink-0 items-center gap-2 font-sans text-sm text-on-surface">
          <Checkbox checked={enabled} onCheckedChange={setEnabled} aria-label={`Aktifkan ${title}`} />
          Aktif
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {NUMERIC_FIELDS[ruleType].map((field) => (
          <div key={field.key} className="flex flex-col gap-1">
            <label className="font-sans text-xs font-semibold text-on-surface">{field.label}</label>
            <Input
              type="number"
              step={field.step}
              value={numericValues[field.key] ?? ""}
              onChange={(event) =>
                setNumericValues((current) => ({ ...current, [field.key]: event.target.value }))
              }
            />
          </div>
        ))}

        <div className="flex flex-col gap-1">
          <label className="font-sans text-xs font-semibold text-on-surface">Tingkat Notifikasi</label>
          <Select
            options={LEVEL_OPTIONS}
            value={level}
            onValueChange={(v) => setLevel(v as NotificationLevel)}
            aria-label={`Tingkat notifikasi ${title}`}
          />
        </div>
      </div>

      {error ? <p className="font-sans text-xs text-brand-critical-red">{error}</p> : null}
      {saved ? <p className="font-sans text-xs text-brand-safe-green">Tersimpan.</p> : null}

      <Button type="button" onClick={() => void handleSave()} disabled={isSaving} className="self-start">
        {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
      </Button>
    </div>
  );
}
