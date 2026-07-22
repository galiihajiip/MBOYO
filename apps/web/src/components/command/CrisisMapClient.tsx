"use client";

import dynamic from "next/dynamic";
import type { CrisisMapProps } from "./CrisisMap";

const CrisisMap = dynamic(() => import("./CrisisMap").then((mod) => mod.CrisisMap), {
  ssr: false,
  loading: () => (
    <div className="h-96 w-full animate-pulse rounded-md bg-surface-container-low md:h-[32rem]" />
  ),
});

export function CrisisMapClient(props: CrisisMapProps) {
  return <CrisisMap {...props} />;
}
