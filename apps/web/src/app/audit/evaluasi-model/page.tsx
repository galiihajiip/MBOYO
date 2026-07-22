import type { Metadata } from "next";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { listModelEvaluations, listModelRegistryEntries } from "../../../lib/audit/model-registry";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Evaluasi Model — MBOYO" };

/**
 * Evaluasi Model (BLOCK 26) — replacing the earlier stub. Read-only list
 * of model_evaluations rows (macro-F1/destroyed-recall/calibration-error,
 * all measured per SUCCESS_METRICS.md's release gate, never fabricated —
 * enforced at the DB layer by NOT NULL + bounded check constraints), each
 * linked to its model_registry_entries version for model comparison.
 */
export default async function EvaluasiModelPage() {
  const supabase = await createServerSupabaseClient();
  const [evaluations, entries] = await Promise.all([listModelEvaluations(supabase), listModelRegistryEntries(supabase)]);
  const versionByEntryId = new Map(entries.map((e) => [e.id, e.version]));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-sans text-2xl font-bold text-on-surface">Evaluasi Model</h1>

      <ul className="flex flex-col gap-2">
        {evaluations.map((evaluation) => (
          <li key={evaluation.id} className="flex flex-col gap-1 rounded-md border border-brand-border bg-surface-container-lowest p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold text-on-surface">
                {versionByEntryId.get(evaluation.modelRegistryEntryId) ?? evaluation.modelRegistryEntryId}
              </span>
              <span className="font-sans text-xs text-on-surface-variant">{evaluation.datasetIdentity}</span>
            </div>
            <dl className="grid grid-cols-3 gap-x-4 gap-y-1 font-sans text-xs">
              <dt className="text-on-surface-variant">Macro-F1</dt>
              <dt className="text-on-surface-variant">Recall Hancur Total</dt>
              <dt className="text-on-surface-variant">Galat Kalibrasi</dt>
              <dd className="font-mono text-on-surface">{evaluation.macroF1.toFixed(4)}</dd>
              <dd className="font-mono text-on-surface">{evaluation.destroyedRecall.toFixed(4)}</dd>
              <dd className="font-mono text-on-surface">{evaluation.calibrationError.toFixed(4)}</dd>
            </dl>
            <span className="font-mono text-xs text-on-surface-variant">
              Dievaluasi {new Date(evaluation.evaluatedAt).toLocaleString("id-ID")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
