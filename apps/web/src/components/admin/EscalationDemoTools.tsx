"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Select } from "@mboyo/ui";

export interface EscalationDemoToolsProps {
  events: { id: string; name: string }[];
}

/**
 * Demo tools (BLOCK 25) — "simulate verified destroyed report" and
 * "deterministic cluster escalation," this block's explicit demo
 * requirement. Both buttons call a system_administrator-only RPC
 * (simulate_verified_destroyed_report /
 * simulate_cluster_destroyed_escalation) that inserts real rows through
 * the same tables a genuine report flows through, then evaluates
 * escalations synchronously — the resulting notification is visible on
 * /command/notifikasi or /verifier/notifikasi immediately after, via the
 * realtime subscription, with no page refresh needed on that screen.
 */
export function EscalationDemoTools({ events }: EscalationDemoToolsProps) {
  const router = useRouter();
  const [disasterEventId, setDisasterEventId] = useState(events[0]?.id ?? "");
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runSimulation(endpoint: string, extraBody: Record<string, unknown>) {
    setIsRunning(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disasterEventId, ...extraBody }),
      });
      const body = (await response.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) {
        setError(body.error?.message ?? "Gagal menjalankan simulasi.");
        return;
      }
      setResult("Simulasi berhasil — periksa Notifikasi untuk melihat peringatan eskalasi.");
      router.refresh();
    } catch {
      setError("Gagal menghubungi server untuk menjalankan simulasi.");
    } finally {
      setIsRunning(false);
    }
  }

  if (events.length === 0) {
    return <p className="font-sans text-sm text-on-surface-variant">Belum ada event bencana untuk disimulasikan.</p>;
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-dashed border-brand-border p-4">
      <h2 className="font-sans text-sm font-bold text-on-surface">Demo: Uji Aturan Eskalasi</h2>
      <p className="font-sans text-xs text-on-surface-variant">
        Alat ini membuat laporan simulasi sungguhan (bukan data palsu terpisah) untuk menguji aturan eskalasi di
        atas. Hanya tersedia untuk Administrator Sistem.
      </p>

      <div className="flex flex-col gap-1">
        <label className="font-sans text-xs font-semibold text-on-surface">Event Bencana</label>
        <Select
          options={events.map((event) => ({ value: event.id, label: event.name }))}
          value={disasterEventId}
          onValueChange={setDisasterEventId}
          aria-label="Event Bencana untuk simulasi"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={isRunning}
          onClick={() =>
            void runSimulation("/api/admin/demo/simulate-destroyed-report", { longitude: 106.827, latitude: -6.175 })
          }
        >
          Simulasikan Laporan Kerusakan Parah
        </Button>
        <Button
          type="button"
          variant="critical"
          disabled={isRunning}
          onClick={() =>
            void runSimulation("/api/admin/demo/simulate-cluster-escalation", {
              centerLongitude: 106.827,
              centerLatitude: -6.175,
            })
          }
        >
          Simulasikan Eskalasi Klaster
        </Button>
      </div>

      {error ? <p className="font-sans text-xs text-brand-critical-red">{error}</p> : null}
      {result ? <p className="font-sans text-xs text-brand-safe-green">{result}</p> : null}
    </div>
  );
}
