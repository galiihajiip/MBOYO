import type { Metadata } from "next";
import { EmptyState } from "@mboyo/ui";
import { getCurrentUser } from "../../lib/auth/server";
import { createServerSupabaseClient } from "../../lib/supabase/server";
import { listAuditEvents } from "../../lib/audit/trail";
import { AuditTrailFilters } from "../../components/audit/AuditTrailFilters";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Audit Trail — MBOYO" };

interface SearchParams {
  [key: string]: string | string[] | undefined;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Audit Trail (BLOCK 27) — replacing the earlier welcome-only landing.
 * Filterable read of audit_events with full detail (entity/actor/action/
 * detail jsonb) inline per row. Zero mutating affordances anywhere on
 * this page — "Auditor cannot mutate" is satisfied structurally: this
 * page only ever calls listAuditEvents, no write path exists in its
 * import graph.
 */
export default async function AuditHomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const supabase = await createServerSupabaseClient();

  const events = await listAuditEvents(supabase, {
    entityType: first(params.entityType),
    action: first(params.action),
    actorProfileId: first(params.actorProfileId),
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-sans text-2xl font-bold text-on-surface">Selamat datang, {user?.displayName}</h1>
        <p className="mt-2 font-sans text-sm text-on-surface-variant">Jejak Audit — Mode Audit — Hanya Baca.</p>
      </div>

      <AuditTrailFilters />

      {events.length === 0 ? (
        <EmptyState title="Tidak ada jejak audit" description="Tidak ada jejak audit yang sesuai dengan filter ini." />
      ) : (
        <ul className="flex flex-col gap-2">
          {events.map((event) => (
            <li key={event.id} className="flex flex-col gap-1 rounded-md border border-brand-border bg-surface-container-lowest p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-sm font-semibold text-on-surface">{event.action}</span>
                <span className="font-mono text-xs text-on-surface-variant">
                  {new Date(event.occurredAt).toLocaleString("id-ID")}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-sans text-xs">
                <dt className="text-on-surface-variant">Entitas</dt>
                <dd className="font-mono text-on-surface">
                  {event.entityType} · {event.entityId}
                </dd>
                <dt className="text-on-surface-variant">Pelaku</dt>
                <dd className="font-mono text-on-surface">{event.actorProfileId ?? "(sistem)"}</dd>
              </dl>
              {Object.keys(event.detail).length > 0 ? (
                <pre className="overflow-x-auto rounded-sm bg-surface-container-low p-2 font-mono text-xs text-on-surface-variant">
                  {JSON.stringify(event.detail, null, 2)}
                </pre>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
