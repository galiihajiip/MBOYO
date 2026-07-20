"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select, Checkbox } from "@mboyo/ui";
import { SEVERITY_CLASSES } from "@mboyo/domain";

const SEVERITY_OPTIONS = [
  { value: "", label: "Semua Keparahan" },
  ...SEVERITY_CLASSES.map((severity) => ({ value: severity, label: severity })),
];

/** Peta Bukti's filter bar (BLOCK 23) — severity + needs_manual_review-only toggle, per docs/product/SCREEN_INVENTORY.md. Same URL-query-string-as-state pattern as QueueFilters. */
export function PetaBuktiFilters() {
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
        value={searchParams.get("predictedSeverity") ?? ""}
        onValueChange={(value) => setParam("predictedSeverity", value)}
        placeholder="Keparahan"
      />
      <label className="flex items-center gap-2 font-sans text-sm text-on-surface">
        <Checkbox
          checked={searchParams.get("needsReviewOnly") === "true"}
          onCheckedChange={(checked) => setParam("needsReviewOnly", checked ? "true" : null)}
          aria-label="Hanya yang perlu tinjauan manual"
        />
        Hanya Perlu Tinjauan Manual
      </label>
    </div>
  );
}
