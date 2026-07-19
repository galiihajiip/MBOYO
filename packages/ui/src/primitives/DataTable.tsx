import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Right-align numeric/mono columns (IDs, coordinates, metrics). */
  align?: "left" | "right";
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  className?: string;
  onRowClick?: (row: T) => void;
}

/**
 * Generic data table using real <table> markup for correct screen-reader
 * semantics (row/column headers, navigation) — per docs/product/SCREEN_INVENTORY.md
 * desktop table patterns (Semua Laporan, Pengguna & Role, Tugas Respons, etc).
 * Callers are responsible for switching to a card list on mobile per each
 * screen's Responsive Hierarchy spec — this component does not attempt to
 * auto-collapse itself, since the right mobile layout differs per screen.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  className,
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div className={cn("overflow-x-auto rounded-lg border border-brand-border", className)}>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-brand-border bg-surface-container-low">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "px-4 py-3 font-sans text-xs font-bold uppercase tracking-wide text-on-surface-variant",
                  column.align === "right" && "text-right",
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={getRowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                "border-b border-brand-border last:border-b-0",
                onRowClick && "cursor-pointer hover:bg-brand-mist",
              )}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    "px-4 py-3 font-sans text-sm text-on-surface",
                    column.align === "right" && "text-right",
                  )}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
