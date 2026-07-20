import type { Metadata } from "next";
import { AntreanOfflineClient } from "./AntreanOfflineClient";

export const metadata: Metadata = { title: "Antrean Offline — MBOYO" };

export default function AntreanOfflinePage() {
  return <AntreanOfflineClient />;
}
