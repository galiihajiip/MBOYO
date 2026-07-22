import type { Metadata } from "next";
import Link from "next/link";
import { Button, EmptyState } from "@mboyo/ui";
import { paginationRequestSchema, taskListFiltersSchema } from "@mboyo/domain";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { listResponseTasks } from "../../../lib/command/tasks";
import { TaskFilters } from "../../../components/command/TaskFilters";
import { TaskList } from "../../../components/command/TaskList";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tugas Respons — MBOYO" };

interface SearchParams {
  [key: string]: string | string[] | undefined;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Tugas Respons (BLOCK 24) — the response-task list with status/priority/overdue filters, replacing the earlier stub. */
export default async function TugasResponsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();

  const filters = taskListFiltersSchema.parse({
    status: first(params.status),
    priority: first(params.priority),
    overdueOnly: first(params.overdueOnly) === "true" ? true : undefined,
  });
  const pagination = paginationRequestSchema.parse({
    page: first(params.page),
    pageSize: first(params.pageSize),
  });

  const result = await listResponseTasks(supabase, filters, pagination);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-sans text-2xl font-bold text-on-surface">Tugas Respons</h1>
          <p className="mt-1 font-sans text-sm text-on-surface-variant">{result.totalCount} tugas ditemukan.</p>
        </div>
        <Link href="/command/tugas/baru">
          <Button>Buat Tugas Baru</Button>
        </Link>
      </div>

      <TaskFilters />

      {result.items.length === 0 ? (
        <EmptyState title="Tidak ada tugas" description="Belum ada tugas respons yang sesuai dengan filter ini." />
      ) : (
        <TaskList tasks={result.items} />
      )}
    </div>
  );
}
