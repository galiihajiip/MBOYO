"use client";

import dynamic from "next/dynamic";
import type { EvidenceMapPin } from "./EvidenceMap";

const EvidenceMap = dynamic(() => import("./EvidenceMap").then((mod) => mod.EvidenceMap), {
  ssr: false,
  loading: () => (
    <div className="h-96 w-full animate-pulse rounded-md bg-surface-container-low md:h-[32rem]" />
  ),
});

export function EvidenceMapClient({ pins }: { pins: EvidenceMapPin[] }) {
  return <EvidenceMap pins={pins} />;
}
