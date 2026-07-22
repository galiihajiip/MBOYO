import type { Metadata } from "next";
import { Badge, Button, EmptyState, StatusBadge, Timeline, priorityLabels, taskStatusLabels, type TimelineEvent } from "@mboyo/ui";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { getResponseTaskById, listTaskAssignments } from "../../../../lib/command/tasks";
import { ApiError } from "../../../../lib/api/errors";
import { PriorityDialog } from "../../../../components/command/PriorityDialog";
import { TaskDetailActions } from "../../../../components/command/TaskDetailActions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Detail Tugas — MBOYO" };

/**
 * Task detail (BLOCK 24) — category/description/due/resources, current
 * status + priority (with the same PriorityDialog Prioritas uses), a
 * Timeline of the full assignment history (task_assignments, most recent
 * first — every reassignment stays visible, matching this block's
 * "immutable history" posture already established for verification_reviews
 * in BLOCK 23), and the status-transition/assignment/cancel controls.
 * "Coordinator cannot alter evidence or verifier decision" — this page
 * links to nothing on the source report/cluster beyond a read-only
 * reference id, never a report-editing or re-verification action.
 */
export default async function TaskDetailPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const supabase = await createServerSupabaseClient();

  let task;
  try {
    task = await getResponseTaskById(supabase, taskId);
  } catch (error) {
    if (error instanceof ApiError && error.code === "not_found") {
      return <EmptyState title="Tugas tidak ditemukan" description="Tugas respons ini tidak ditemukan." />;
    }
    throw error;
  }

  const assignments = await listTaskAssignments(supabase, taskId);

  const events: TimelineEvent[] = assignments.map((assignment) => ({
    id: assignment.id,
    title: assignment.unassignedAt ? "Penugasan Digantikan" : "Ditugaskan",
    timestamp: new Date(assignment.assignedAt).toLocaleString("id-ID"),
    description: `Profil penerima: ${assignment.assigneeProfileId}`,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-sans text-2xl font-bold text-on-surface">{task.category ?? "Tugas Respons"}</h1>
        <StatusBadge label={taskStatusLabels[task.status]} tone="info" />
        <Badge tone={task.priority === "critical" ? "critical" : "neutral"}>{priorityLabels[task.priority]}</Badge>
      </div>

      {task.description ? <p className="font-sans text-sm text-on-surface">{task.description}</p> : null}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border border-brand-border p-4 font-sans text-sm">
        <dt className="text-on-surface-variant">Sumber</dt>
        <dd className="text-on-surface">
          {task.reportId ? `Laporan ${task.reportId}` : `Klaster ${task.incidentClusterId}`}
        </dd>
        <dt className="text-on-surface-variant">Batas Waktu</dt>
        <dd className="text-on-surface">{task.dueAt ? new Date(task.dueAt).toLocaleString("id-ID") : "Tidak ditentukan"}</dd>
        {task.resources ? (
          <>
            <dt className="text-on-surface-variant">Sumber Daya</dt>
            <dd className="text-on-surface">{task.resources}</dd>
          </>
        ) : null}
      </dl>

      <PriorityDialog
        trigger={<Button variant="ghost">Ubah Prioritas</Button>}
        title={`Prioritas — ${task.category ?? "Tugas"}`}
        currentPriority={task.priority}
        endpoint={`/api/command/tasks/${task.id}/priority`}
      />

      <TaskDetailActions taskId={task.id} status={task.status} />

      <section className="flex flex-col gap-2">
        <h2 className="font-sans text-sm font-bold text-on-surface">Riwayat Penugasan</h2>
        {events.length === 0 ? (
          <p className="font-sans text-sm text-on-surface-variant">Belum ada penugasan untuk tugas ini.</p>
        ) : (
          <Timeline events={events} />
        )}
      </section>
    </div>
  );
}
