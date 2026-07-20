import Link from "next/link";

export interface NotificationAreaProps {
  href: string;
  /** Unread count; 0/undefined renders no badge. Real data wired in a later block. */
  unreadCount?: number;
}

/**
 * Topbar notification bell — links to the role's Notifikasi screen.
 * Reporter and Auditor have no Notifikasi nav item per
 * docs/product/NAVIGATION_BY_ROLE.md, so this component is omitted from
 * their shells entirely (see AppShell.tsx), not just hidden.
 */
export function NotificationArea({ href, unreadCount }: NotificationAreaProps) {
  return (
    <Link
      href={href}
      aria-label={unreadCount ? `Notifikasi, ${unreadCount} belum dibaca` : "Notifikasi"}
      className="relative flex h-11 w-11 items-center justify-center rounded-md text-on-surface-variant hover:bg-brand-mist hover:text-on-surface"
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
        <path
          d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M10 18.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      {unreadCount ? (
        <span
          aria-hidden="true"
          className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-critical-red px-1 font-mono text-[10px] font-bold text-brand-cloud-white"
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
