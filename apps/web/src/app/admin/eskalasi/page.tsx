import type { Metadata } from "next";
import type { EscalationRuleType } from "@mboyo/domain";
import { requireApiActor } from "../../../lib/api/authorize";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { getServerEnv } from "../../../lib/env.server";
import { listEscalationSettings } from "../../../lib/notifications/escalation-settings";
import { EscalationRuleForm } from "../../../components/admin/EscalationRuleForm";
import { EscalationDemoTools } from "../../../components/admin/EscalationDemoTools";

interface DisasterEventRow {
  id: string;
  name: string;
}

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Aturan Eskalasi — MBOYO" };

const RULE_COPY: Record<EscalationRuleType, { title: string; description: string }> = {
  verified_destroyed_threshold: {
    title: "Kerusakan Parah Terverifikasi",
    description: "Memicu notifikasi saat sebuah laporan terverifikasi memiliki probabilitas kerusakan parah di atas ambang batas.",
  },
  cluster_destroyed_radius: {
    title: "Klaster Kerusakan Parah",
    description: "Memicu notifikasi saat beberapa laporan kerusakan parah muncul berdekatan dalam radius dan jendela waktu tertentu.",
  },
  verifier_sla_breach: {
    title: "Batas Waktu Tinjauan Verifikator",
    description: "Memicu notifikasi saat sebuah laporan menunggu keputusan verifikasi melebihi jumlah jam yang ditentukan.",
  },
  task_overdue: {
    title: "Tugas Respons Terlambat",
    description: "Memicu notifikasi saat sebuah tugas respons melewati batas waktunya tanpa diselesaikan atau dibatalkan.",
  },
  repeated_duplicate_source: {
    title: "Sumber Laporan Duplikat Berulang",
    description: "Memicu notifikasi saat satu pelapor menghasilkan beberapa laporan yang ditandai duplikat dalam jendela waktu tertentu.",
  },
  repeated_analysis_failure: {
    title: "Kegagalan Analisis Berulang",
    description: "Memicu notifikasi saat analisis sebuah laporan gagal berulang kali dalam jendela waktu tertentu.",
  },
};

const RULE_ORDER: EscalationRuleType[] = [
  "verified_destroyed_threshold",
  "cluster_destroyed_radius",
  "verifier_sla_breach",
  "task_overdue",
  "repeated_duplicate_source",
  "repeated_analysis_failure",
];

/**
 * Aturan Eskalasi (BLOCK 25) — replacing the earlier stub. Per this
 * block's requirement, thresholds tune when a report/task/source is
 * flagged for extra attention; they never disable human verification
 * itself (no escalation rule here can skip a Verifier's own decision —
 * that remains submit_verification_decision's exclusive domain,
 * completely untouched by this screen).
 */
export default async function AturanEskalasiPage() {
  const actor = await requireApiActor();
  const supabase = await createServerSupabaseClient();
  const settings = await listEscalationSettings(supabase, actor.organizationId);
  const settingsByRuleType = new Map(settings.map((s) => [s.ruleType, s.value]));

  const demoModeEnabled = getServerEnv().DEMO_MODE;
  const { data: events } = demoModeEnabled
    ? await supabase.from("disaster_events").select("id, name").returns<DisasterEventRow[]>()
    : { data: null };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-sans text-2xl font-bold text-on-surface">Aturan Eskalasi</h1>
        <p className="mt-1 font-sans text-sm text-on-surface-variant">
          Konfigurasi ambang batas yang memicu notifikasi eskalasi. Perubahan berlaku langsung tanpa perlu memulai
          ulang sistem.
        </p>
      </div>

      {RULE_ORDER.map((ruleType) => (
        <EscalationRuleForm
          key={ruleType}
          ruleType={ruleType}
          title={RULE_COPY[ruleType].title}
          description={RULE_COPY[ruleType].description}
          value={settingsByRuleType.get(ruleType) ?? { enabled: true, level: "warning" }}
        />
      ))}

      {demoModeEnabled ? <EscalationDemoTools events={events ?? []} /> : null}
    </div>
  );
}
