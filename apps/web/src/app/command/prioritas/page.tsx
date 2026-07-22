import type { Metadata } from "next";
import { Badge, Button, EmptyState, priorityLabels } from "@mboyo/ui";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { listClusterSummaries } from "../../../lib/command/clusters";
import { listResponseTasks } from "../../../lib/command/tasks";
import { PriorityDialog } from "../../../components/command/PriorityDialog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Prioritas — MBOYO" };

interface SearchParams {
  [key: string]: string | string[] | undefined;
}

function priorityBadgeTone(priority: string): "neutral" | "success" | "warning" | "priority" | "critical" {
  switch (priority) {
    case "critical":
      return "critical";
    case "high":
      return "priority";
    case "medium":
      return "warning";
    case "low":
      return "success";
    default:
      return "neutral";
  }
}

/**
 * Prioritas (BLOCK 24) — the Coordinator's priority-setting workflow for
 * both incident_clusters and response_tasks, since STATE_MACHINES.md
 * documents priority as Coordinator-only, settable any time before a task
 * is completed/cancelled, and never derived from model_prediction
 * severity — this screen is where that operational judgment is actually
 * exercised. Critical priority is gated by PriorityDialog's own
 * reason-required behavior, mirroring setPrioritySchema/
 * set_response_task_priority()/set_incident_cluster_priority()'s identical
 * server-side rule.
 */
export default async function PrioritasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await searchParams;
  const supabase = await createServerSupabaseClient();

  const [clusters, tasksResult] = await Promise.all([
    listClusterSummaries(supabase),
    listResponseTasks(supabase, {}, { page: 1, pageSize: 50 }),
  ]);

  const openTasks = tasksResult.items.filter((task) => task.status !== "completed" && task.status !== "cancelled");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-sans text-2xl font-bold text-on-surface">Prioritas</h1>
        <p className="mt-1 font-sans text-sm text-on-surface-variant">
          Prioritas operasional bersifat terpisah dari tingkat keparahan model — tetapkan berdasarkan penilaian
          operasional Anda.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-sans text-lg font-bold text-on-surface">Klaster Insiden</h2>
        {clusters.length === 0 ? (
          <EmptyState title="Belum ada klaster insiden" description="Buat klaster dari Peta Krisis atau Tugas Respons." />
        ) : (
          <ul className="flex flex-col gap-2">
            {clusters.map((cluster) => (
              <li
                key={cluster.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-brand-border bg-surface-container-lowest p-3"
              >
                <div className="flex flex-col gap-1">
                  <span className="font-sans text-sm font-semibold text-on-surface">{cluster.label}</span>
                  <span className="font-sans text-xs text-on-surface-variant">
                    {cluster.memberCount} laporan · {cluster.taskCount} tugas
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={priorityBadgeTone(cluster.priority)}>{priorityLabels[cluster.priority]}</Badge>
                  <PriorityDialog
                    trigger={<Button variant="ghost">Ubah Prioritas</Button>}
                    title={`Prioritas — ${cluster.label}`}
                    currentPriority={cluster.priority}
                    endpoint={`/api/command/clusters/${cluster.id}/priority`}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-sans text-lg font-bold text-on-surface">Tugas Respons</h2>
        {openTasks.length === 0 ? (
          <EmptyState title="Tidak ada tugas aktif" description="Semua tugas telah selesai atau dibatalkan." />
        ) : (
          <ul className="flex flex-col gap-2">
            {openTasks.map((task) => (
              <li
                key={task.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-brand-border bg-surface-container-lowest p-3"
              >
                <div className="flex flex-col gap-1">
                  <span className="font-sans text-sm font-semibold text-on-surface">
                    {task.category ?? "(Tanpa kategori)"}
                  </span>
                  <span className="font-sans text-xs text-on-surface-variant">Status: {task.status}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={priorityBadgeTone(task.priority)}>{priorityLabels[task.priority]}</Badge>
                  <PriorityDialog
                    trigger={<Button variant="ghost">Ubah Prioritas</Button>}
                    title={`Prioritas — ${task.category ?? "Tugas"}`}
                    currentPriority={task.priority}
                    endpoint={`/api/command/tasks/${task.id}/priority`}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
