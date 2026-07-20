import Image from "next/image";
import Link from "next/link";
import type { Role } from "@mboyo/domain";
import { ConnectivityIndicator } from "./ConnectivityIndicator";
import { NotificationArea } from "./NotificationArea";
import { UserMenu } from "./UserMenu";

export interface TopbarProps {
  displayName: string;
  role: Role;
  homeHref: string;
  profileHref: string;
  /** Omitted entirely (not just hidden) for roles with no Notifikasi nav item — Reporter, Auditor. */
  notificationsHref?: string;
}

/**
 * Shared topbar across all five role shells: wordmark/home link,
 * connectivity indicator, notification area (role-dependent), user menu.
 * Per this block's "shared" requirement — one component, reused by every
 * AppShell instance, so its behavior can never silently diverge per role.
 */
export function Topbar({ displayName, role, homeHref, profileHref, notificationsHref }: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-brand-border bg-surface-container-lowest px-3 sm:px-4">
      <Link href={homeHref} className="flex items-center gap-2" aria-label="MBOYO — Beranda peran">
        <Image src="/icons/logo.svg" alt="" width={28} height={28} />
        <span className="hidden font-sans text-base font-bold text-on-surface sm:inline">MBOYO</span>
      </Link>

      <div className="flex items-center gap-2 sm:gap-3">
        <ConnectivityIndicator />
        {notificationsHref ? <NotificationArea href={notificationsHref} /> : null}
        <UserMenu displayName={displayName} role={role} profileHref={profileHref} />
      </div>
    </header>
  );
}
