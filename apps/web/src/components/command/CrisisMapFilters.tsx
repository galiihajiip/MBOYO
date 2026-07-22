"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select, Checkbox } from "@mboyo/ui";
import { SEVERITY_CLASSES, PRIORITY_LEVELS } from "@mboyo/domain";

const SEVERITY_OPTIONS = [
  { value: "", label: "Semua Keparahan" },
  ...SEVERITY_CLASSES.map((severity) => ({ value: severity, label: severity })),
];

const PRIORITY_OPTIONS = [
  { value: "", label: "Semua Prioritas Klaster" },
  ...PRIORITY_LEVELS.map((priority) => ({ value: priority, label: priority })),
];

/** Peta Krisis's filter bar (BLOCK 24) — severity, cluster priority, and heat-layer toggle. Same URL-query-string-as-state pattern as PetaBuktiFilters. */
export function CrisisMapFilters() {
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
        aria-label="Filter berdasarkan keparahan prediksi"
        options={SEVERITY_OPTIONS}
        value={searchParams.get("severity") ?? ""}
        onValueChange={(value) => setParam("severity", value)}
        placeholder="Keparahan"
      />
      <Select
        aria-label="Filter berdasarkan prioritas klaster"
        options={PRIORITY_OPTIONS}
        value={searchParams.get("clusterPriority") ?? ""}
        onValueChange={(value) => setParam("clusterPriority", value)}
        placeholder="Prioritas Klaster"
      />
      <label className="flex items-center gap-2 font-sans text-sm text-on-surface">
        <Checkbox
          checked={searchParams.get("heat") === "true"}
          onCheckedChange={(checked) => setParam("heat", checked ? "true" : null)}
          aria-label="Tampilkan lapisan panas"
        />
        Lapisan Panas
      </label>
    </div>
  );
}
