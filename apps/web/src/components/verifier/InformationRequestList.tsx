"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, type DataTableColumn } from "@mboyo/ui";
import type { InformationRequestReport } from "../../lib/reports/service/information-requests";

const COLUMNS: DataTableColumn<InformationRequestReport>[] = [
  { key: "description", header: "Deskripsi", render: (r) => r.description ?? "(Tidak ada deskripsi)" },
  { key: "requestNotes", header: "Catatan Permintaan", render: (r) => r.requestNotes ?? "—" },
  {
    key: "requestedAt",
    header: "Diminta Pada",
    align: "right",
    render: (r) => new Date(r.requestedAt).toLocaleString("id-ID"),
  },
];

/** Permintaan Informasi's list (BLOCK 23) — tapping an item returns to the report detail to finalize a decision, per docs/product/SCREEN_INVENTORY.md. */
export function InformationRequestList({ requests }: { requests: InformationRequestReport[] }) {
  const router = useRouter();

  return (
    <>
      <div className="hidden md:block">
        <DataTable
          columns={COLUMNS}
          rows={requests}
          getRowKey={(r) => r.id}
          onRowClick={(r) => router.push(`/verifier/laporan/${r.id}`)}
        />
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {requests.map((r) => (
          <li key={r.id}>
            <Link
              href={`/verifier/laporan/${r.id}`}
              className="flex flex-col gap-2 rounded-md border border-brand-border bg-surface-container-lowest p-4"
            >
              <p className="line-clamp-2 font-sans text-sm text-on-surface">
                {r.description ?? "(Tidak ada deskripsi)"}
              </p>
              {r.requestNotes ? (
                <p className="font-sans text-xs text-on-surface-variant">{r.requestNotes}</p>
              ) : null}
              <span className="font-mono text-xs text-on-surface-variant">
                {new Date(r.requestedAt).toLocaleDateString("id-ID")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
