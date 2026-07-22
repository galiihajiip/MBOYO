import type { Metadata } from "next";
import { Badge } from "@mboyo/ui";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { getModelUsageSummary, listModelRegistryEntries } from "../../../lib/audit/model-registry";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Model Registry — MBOYO" };

/**
 * Model Registry (BLOCK 26) — replacing the earlier stub. Read-only
 * version/promotion history plus prediction-count usage per version, per
 * this block's "model usage" Auditor requirement and "prediction model
 * version is traceable" acceptance criterion — every entry's version
 * string is what apps/web/src/lib/reports/service/analysis.ts already
 * surfaces on the Verifier detail page's "Versi model" field, so a
 * prediction can always be traced back to exactly one row here.
 */
export default async function ModelRegistryPage() {
  const supabase = await createServerSupabaseClient();
  const [entries, usage] = await Promise.all([listModelRegistryEntries(supabase), getModelUsageSummary(supabase)]);
  const usageByEntryId = new Map(usage.map((u) => [u.modelRegistryEntryId, u.predictionCount]));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-sans text-2xl font-bold text-on-surface">Model Registry</h1>

      <ul className="flex flex-col gap-2">
        {entries.map((entry) => (
          <li key={entry.id} className="flex flex-col gap-1 rounded-md border border-brand-border bg-surface-container-lowest p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold text-on-surface">{entry.version}</span>
              {entry.isActive ? <Badge tone="success">Aktif</Badge> : null}
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-sans text-xs">
              <dt className="text-on-surface-variant">Dilatih pada</dt>
              <dd className="text-on-surface">{new Date(entry.trainedAt).toLocaleString("id-ID")}</dd>
              {entry.promotedAt ? (
                <>
                  <dt className="text-on-surface-variant">Dipromosikan pada</dt>
                  <dd className="text-on-surface">{new Date(entry.promotedAt).toLocaleString("id-ID")}</dd>
                </>
              ) : null}
              <dt className="text-on-surface-variant">Jumlah Prediksi</dt>
              <dd className="text-on-surface">{usageByEntryId.get(entry.id) ?? 0}</dd>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
