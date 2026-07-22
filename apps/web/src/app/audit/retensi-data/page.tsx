import type { Metadata } from "next";
import { Badge, EmptyState } from "@mboyo/ui";
import { requireApiActor } from "../../../lib/api/authorize";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { listDeletionRequests, listLegalHolds, listRetentionPolicies } from "../../../lib/admin/retention";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Retensi Data — MBOYO" };

const POLICY_TITLES: Record<string, string> = {
  evidence_retention_days: "Retensi Bukti Foto",
  audit_retention_days: "Retensi Jejak Audit",
};

/**
 * Retensi Data (BLOCK 27) — replacing the earlier stub. Read-only
 * visibility into the declared retention policy, deletion-request
 * history, and legal-hold status — "retention/deletion evidence" per
 * this block's Auditor requirement. Zero mutating affordances anywhere:
 * this page only ever calls list* read functions, matching "Auditor
 * cannot mutate" everywhere else in this portal.
 */
export default async function RetensiDataPage() {
  const actor = await requireApiActor();
  const supabase = await createServerSupabaseClient();
  const [policies, deletionRequests, legalHolds] = await Promise.all([
    listRetentionPolicies(supabase, actor.organizationId),
    listDeletionRequests(supabase),
    listLegalHolds(supabase),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-sans text-2xl font-bold text-on-surface">Retensi Data</h1>

      <section className="flex flex-col gap-2">
        <h2 className="font-sans text-lg font-bold text-on-surface">Kebijakan Retensi yang Dideklarasikan</h2>
        <p className="font-sans text-xs text-on-surface-variant">
          Nilai ini belum ditegakkan oleh proses terjadwal otomatis — lihat sebagai kebijakan yang dinyatakan, bukan
          jaminan penghapusan aktual.
        </p>
        <ul className="flex flex-col gap-2">
          {policies.map((policy) => (
            <li key={policy.key} className="flex items-center justify-between gap-2 rounded-md border border-brand-border bg-surface-container-lowest p-3">
              <span className="font-sans text-sm text-on-surface">{POLICY_TITLES[policy.key] ?? policy.key}</span>
              <div className="flex items-center gap-2">
                <Badge tone={policy.enabled ? "success" : "neutral"}>{policy.enabled ? "Aktif" : "Nonaktif"}</Badge>
                <span className="font-mono text-sm text-on-surface">{policy.days} hari</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-sans text-lg font-bold text-on-surface">Permintaan Penghapusan Data</h2>
        {deletionRequests.length === 0 ? (
          <EmptyState title="Tidak ada permintaan" description="Belum ada permintaan penghapusan data." />
        ) : (
          <ul className="flex flex-col gap-2">
            {deletionRequests.map((request) => (
              <li key={request.id} className="flex flex-col gap-1 rounded-md border border-brand-border bg-surface-container-lowest p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge tone="info">{request.status}</Badge>
                  <span className="font-mono text-xs text-on-surface-variant">
                    {new Date(request.createdAt).toLocaleString("id-ID")}
                  </span>
                </div>
                <p className="font-sans text-sm text-on-surface">{request.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-sans text-lg font-bold text-on-surface">Penahanan Hukum (Legal Hold)</h2>
        {legalHolds.length === 0 ? (
          <EmptyState title="Tidak ada penahanan hukum" description="Belum ada penahanan hukum yang aktif." />
        ) : (
          <ul className="flex flex-col gap-2">
            {legalHolds.map((hold) => (
              <li key={hold.id} className="flex flex-col gap-1 rounded-md border border-brand-border bg-surface-container-lowest p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge tone={hold.releasedAt ? "neutral" : "warning"}>{hold.releasedAt ? "Dilepaskan" : "Aktif"}</Badge>
                  <span className="font-mono text-xs text-on-surface-variant">
                    {new Date(hold.placedAt).toLocaleString("id-ID")}
                  </span>
                </div>
                <p className="font-sans text-sm text-on-surface">{hold.reason}</p>
                <span className="font-mono text-xs text-on-surface-variant">
                  {hold.reportId ? `Laporan: ${hold.reportId}` : `Event: ${hold.disasterEventId}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
