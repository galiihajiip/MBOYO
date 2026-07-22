"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select, Checkbox } from "@mboyo/ui";
import { TASK_STATUSES, PRIORITY_LEVELS } from "@mboyo/domain";

const STATUS_OPTIONS = [
  { value: "", label: "Semua Status" },
  ...TASK_STATUSES.map((status) => ({ value: status, label: status })),
];

const PRIORITY_OPTIONS = [
  { value: "", label: "Semua Prioritas" },
  ...PRIORITY_LEVELS.map((priority) => ({ value: priority, label: priority })),
];

/** Tugas Respons's filter bar (BLOCK 24) — status, priority, overdue-only. Same URL-query-string-as-state pattern as QueueFilters/PetaBuktiFilters. */
export function TaskFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-brand-border bg-surface-container-lowest p-3">
      <Select
        aria-label="Filter berdasarkan status"
        options={STATUS_OPTIONS}
        value={searchParams.get("status") ?? ""}
        onValueChange={(value) => setParam("status", value)}
        placeholder="Status"
      />
      <Select
        aria-label="Filter berdasarkan prioritas"
        options={PRIORITY_OPTIONS}
        value={searchParams.get("priority") ?? ""}
        onValueChange={(value) => setParam("priority", value)}
        placeholder="Prioritas"
      />
      <label className="flex items-center gap-2 font-sans text-sm text-on-surface">
        <Checkbox
          checked={searchParams.get("overdueOnly") === "true"}
          onCheckedChange={(checked) => setParam("overdueOnly", checked ? "true" : null)}
          aria-label="Hanya yang terlambat"
        />
        Hanya Terlambat
      </label>
    </div>
  );
}
