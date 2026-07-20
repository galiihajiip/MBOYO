"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select, Checkbox } from "@mboyo/ui";
import { SEVERITY_CLASSES } from "@mboyo/domain";

const SEVERITY_OPTIONS = [
  { value: "", label: "Semua Keparahan" },
  ...SEVERITY_CLASSES.map((severity) => ({ value: severity, label: severity })),
];

/**
 * Antrean Verifikasi's filter bar (BLOCK 23) — every filter
 * docs/product/SCREEN_INVENTORY.md requires (severity, quality, escalation
 * flag, age) plus this block's additional confidence/duplicate/GPS-accuracy
 * filters. State lives entirely in the URL query string (not component
 * state) so a filtered view is bookmarkable/shareable and survives a page
 * reload — the server component (page.tsx) reads searchParams directly on
 * every navigation, this component only ever pushes new query strings.
 */
export function QueueFilters() {
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
    params.delete("page");
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
          checked={searchParams.get("maxQualityScore") === "0.5"}
          onCheckedChange={(checked) => setParam("maxQualityScore", checked ? "0.5" : null)}
          aria-label="Hanya kualitas rendah"
        />
        Kualitas Rendah
      </label>

      <label className="flex items-center gap-2 font-sans text-sm text-on-surface">
        <Checkbox
          checked={searchParams.get("hasDuplicateCandidate") === "true"}
          onCheckedChange={(checked) => setParam("hasDuplicateCandidate", checked ? "true" : null)}
          aria-label="Hanya kandidat duplikat"
        />
        Duplikat
      </label>

      <label className="flex items-center gap-2 font-sans text-sm text-on-surface">
        <Checkbox
          checked={searchParams.get("escalatedOnly") === "true"}
          onCheckedChange={(checked) => setParam("escalatedOnly", checked ? "true" : null)}
          aria-label="Hanya yang dieskalasi"
        />
        Dieskalasi
      </label>

      <label className="flex items-center gap-2 font-sans text-sm text-on-surface">
        <Checkbox
          checked={searchParams.get("minAgeHours") === "24"}
          onCheckedChange={(checked) => setParam("minAgeHours", checked ? "24" : null)}
          aria-label="Hanya yang menunggu lebih dari 24 jam"
        />
        &gt;24 Jam
      </label>

      <label className="flex items-center gap-2 font-sans text-sm text-on-surface">
        <Checkbox
          checked={searchParams.get("maxGpsAccuracyMeters") === "500"}
          onCheckedChange={(checked) => setParam("maxGpsAccuracyMeters", checked ? "500" : null)}
          aria-label="Sembunyikan akurasi GPS buruk"
        />
        Akurasi GPS Baik
      </label>
    </div>
  );
}
