"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@mboyo/ui";

/**
 * Audit Trail's filter bar (BLOCK 27) — entity type / action / actor
 * profile id, free-text since audit_events.entity_type/action are plain
 * text columns (no fixed enum). Same URL-query-string-as-state pattern as
 * every other filter bar in this codebase (QueueFilters, TaskFilters,
 * etc.) — filtered views stay bookmarkable/shareable.
 */
export function AuditTrailFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim().length === 0) {
      params.delete(key);
    } else {
      params.set(key, value.trim());
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-brand-border bg-surface-container-lowest p-3">
      <Input
        defaultValue={searchParams.get("entityType") ?? ""}
        onBlur={(event) => setParam("entityType", event.target.value)}
        placeholder="Jenis entitas (mis. report)"
        aria-label="Filter berdasarkan jenis entitas"
        className="w-48"
      />
      <Input
        defaultValue={searchParams.get("action") ?? ""}
        onBlur={(event) => setParam("action", event.target.value)}
        placeholder="Aksi (mis. report.verified)"
        aria-label="Filter berdasarkan aksi"
        className="w-48"
      />
      <Input
        defaultValue={searchParams.get("actorProfileId") ?? ""}
        onBlur={(event) => setParam("actorProfileId", event.target.value)}
        placeholder="ID profil pelaku"
        aria-label="Filter berdasarkan pelaku"
        className="w-64"
      />
    </div>
  );
}
