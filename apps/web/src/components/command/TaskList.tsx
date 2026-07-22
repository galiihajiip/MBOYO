"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, DataTable, type DataTableColumn, taskStatusLabels, priorityLabels } from "@mboyo/ui";
import type { ResponseTaskDto } from "../../lib/command/types";

const COLUMNS: DataTableColumn<ResponseTaskDto>[] = [
  { key: "category", header: "Kategori", render: (t) => t.category ?? "(Tanpa kategori)" },
  { key: "status", header: "Status", render: (t) => <Badge tone="info">{taskStatusLabels[t.status]}</Badge> },
  { key: "priority", header: "Prioritas", render: (t) => <Badge tone={t.priority === "critical" ? "critical" : "neutral"}>{priorityLabels[t.priority]}</Badge> },
  {
    key: "dueAt",
    header: "Batas Waktu",
    align: "right",
    render: (t) => (t.dueAt ? new Date(t.dueAt).toLocaleString("id-ID") : "—"),
  },
];

/** Tugas Respons's list (BLOCK 24) — desktop DataTable + mobile card list, same responsive pattern as BLOCK 23's QueueList/AllReportsList. */
export function TaskList({ tasks }: { tasks: ResponseTaskDto[] }) {
  const router = useRouter();

  return (
    <>
      <div className="hidden md:block">
        <DataTable
          columns={COLUMNS}
          rows={tasks}
          getRowKey={(t) => t.id}
          onRowClick={(t) => router.push(`/command/tugas/${t.id}`)}
        />
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {tasks.map((task) => (
          <li key={task.id}>
            <Link
              href={`/command/tugas/${task.id}`}
              className="flex flex-col gap-2 rounded-md border border-brand-border bg-surface-container-lowest p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="info">{taskStatusLabels[task.status]}</Badge>
                <Badge tone={task.priority === "critical" ? "critical" : "neutral"}>{priorityLabels[task.priority]}</Badge>
              </div>
              <p className="font-sans text-sm text-on-surface">{task.category ?? "(Tanpa kategori)"}</p>
              {task.dueAt ? (
                <span className="font-mono text-xs text-on-surface-variant">
                  {new Date(task.dueAt).toLocaleString("id-ID")}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
