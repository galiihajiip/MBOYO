import type { Metadata } from "next";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { requireApiActor } from "../../../lib/api/authorize";
import { listDeletionRequests, listRetentionPolicies } from "../../../lib/admin/retention";
import { RetentionPolicyForm } from "../../../components/admin/RetentionPolicyForm";
import { DeletionRequestReviewList } from "../../../components/admin/DeletionRequestReviewList";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pengaturan — MBOYO" };

const POLICY_TITLES: Record<string, string> = {
  evidence_retention_days: "Retensi Bukti Foto",
  audit_retention_days: "Retensi Jejak Audit",
};

/**
 * Pengaturan (BLOCK 27) — replacing the earlier stub. Retention policy
 * configuration (declared values only — enforcement is disclosed future
 * work) plus the deletion-request review queue. "Audit retention
 * separated from evidence retention" per this block's requirement: two
 * independent policy rows (evidence_retention_days/audit_retention_days),
 * each editable on its own, never a single shared "retention" number.
 */
export default async function PengaturanPage() {
  const actor = await requireApiActor();
  const supabase = await createServerSupabaseClient();
  const [policies, deletionRequests] = await Promise.all([
    listRetentionPolicies(supabase, actor.organizationId),
    listDeletionRequests(supabase),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-sans text-2xl font-bold text-on-surface">Pengaturan</h1>

      <section className="flex flex-col gap-3">
        <h2 className="font-sans text-lg font-bold text-on-surface">Kebijakan Retensi</h2>
        <p className="font-sans text-xs text-on-surface-variant">
          Nilai ini adalah kebijakan yang dideklarasikan — belum ada proses terjadwal yang menegakkannya secara
          otomatis.
        </p>
        {policies.map((policy) => (
          <RetentionPolicyForm
            key={policy.key}
            policyKey={policy.key}
            title={POLICY_TITLES[policy.key] ?? policy.key}
            days={policy.days}
            enabled={policy.enabled}
          />
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-sans text-lg font-bold text-on-surface">Permintaan Penghapusan Data</h2>
        <DeletionRequestReviewList requests={deletionRequests} />
      </section>
    </div>
  );
}
