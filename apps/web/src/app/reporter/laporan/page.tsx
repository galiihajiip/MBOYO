import type { Metadata } from "next";
import { ReportListClient } from "./ReportListClient";

export const metadata: Metadata = { title: "Laporan Saya — MBOYO" };

export default function LaporanSayaPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-sans text-2xl font-bold text-on-surface">Laporan Saya</h1>
      <ReportListClient />
    </div>
  );
}
