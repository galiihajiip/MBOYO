import type { Metadata } from "next";
import { CreateTaskForm } from "../../../../components/command/CreateTaskForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Buat Tugas Baru — MBOYO" };

interface SearchParams {
  [key: string]: string | string[] | undefined;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Tugas Respons creation entry point (BLOCK 24) — reached from Peta Krisis/Prioritas/Semua Laporan with ?reportId= or ?clusterId=. */
export default async function BuatTugasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-sans text-2xl font-bold text-on-surface">Buat Tugas Baru</h1>
      <CreateTaskForm reportId={first(params.reportId)} incidentClusterId={first(params.clusterId)} />
    </div>
  );
}
