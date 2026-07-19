import { Sync } from "./icons/Basic";
import { cn } from "../lib/cn";

export type SyncState = "synced" | "syncing" | "queued" | "failed";

export interface SyncStatusProps {
  state: SyncState;
  pendingCount?: number;
  className?: string;
}

const stateLabel: Record<SyncState, string> = {
  synced: "Tersinkronisasi",
  syncing: "Sedang menyinkronkan...",
  queued: "Menunggu sinkronisasi",
  failed: "Sinkronisasi gagal, akan dicoba lagi",
};

const stateTone: Record<SyncState, string> = {
  synced: "bg-brand-safe-green/15 text-[#1c7a48]",
  syncing: "bg-brand-signal-cyan/15 text-brand-deep-ocean",
  queued: "bg-brand-caution-amber/20 text-[#7a5109]",
  failed: "bg-brand-critical-red/15 text-[#9a2626]",
};

/**
 * Offline queue sync-state indicator per docs/product/SCREEN_INVENTORY.md
 * "Antrean Offline" — surfaces pending count and failure reason honestly;
 * never silently drops a failed item (AGENTS.md offline-first invariant).
 */
export function SyncStatus({ state, pendingCount, className }: SyncStatusProps) {
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-sans text-sm font-semibold",
        stateTone[state],
        className,
      )}
    >
      <Sync
        className={cn("h-4 w-4", state === "syncing" && "animate-spin")}
      />
      {stateLabel[state]}
      {typeof pendingCount === "number" && pendingCount > 0 ? (
        <span className="font-mono">({pendingCount})</span>
      ) : null}
    </span>
  );
}
