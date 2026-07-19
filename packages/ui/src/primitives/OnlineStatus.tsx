import { Wifi, WifiOff } from "./icons/Basic";
import { cn } from "../lib/cn";

export interface OnlineStatusProps {
  online: boolean;
  className?: string;
}

/**
 * Global connectivity indicator per docs/product/SCREEN_INVENTORY.md
 * "Global Offline Banner" — must reflect actual request success/failure,
 * not just navigator.onLine (caller's responsibility to pass the correct
 * `online` value); this component only renders the resulting state honestly.
 */
export function OnlineStatus({ online, className }: OnlineStatusProps) {
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-sans text-sm font-semibold",
        online
          ? "bg-brand-signal-cyan/15 text-brand-deep-ocean"
          : "bg-brand-caution-amber/20 text-[#7a5109]",
        className,
      )}
    >
      {online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
      {online ? "Online" : "Anda sedang offline"}
    </span>
  );
}
