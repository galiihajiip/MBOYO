import type { ReactNode } from "react";
import type { Role } from "@mboyo/domain";
import { Topbar } from "./Topbar";
import { SidebarNav } from "./SidebarNav";
import { TabletRailNav } from "./TabletRailNav";
import { MobileBottomNav } from "./MobileBottomNav";
import { Breadcrumbs, type BreadcrumbItem } from "./Breadcrumbs";
import { ConsentGate } from "./ConsentGate";
import { ROLE_NAV_ITEMS } from "../../lib/navigation/nav-items";

const ROLES_WITH_NOTIFICATIONS: Partial<Record<Role, string>> = {
  verifier: "/verifier/notifikasi",
  response_coordinator: "/command/notifikasi",
};

const ROLE_HOME: Record<Role, string> = {
  reporter: "/reporter",
  verifier: "/verifier",
  response_coordinator: "/command",
  system_administrator: "/admin",
  auditor: "/audit",
};

const ROLE_PROFILE: Record<Role, string> = {
  reporter: "/reporter/profil",
  verifier: "/verifier/profil",
  response_coordinator: "/command/profil",
  system_administrator: "/admin/profil",
  auditor: "/audit/profil",
};

export interface AppShellProps {
  role: Role;
  displayName: string;
  breadcrumbs?: BreadcrumbItem[];
  children: ReactNode;
}

/**
 * The single shell every role-specific layout.tsx composes. Navigation
 * items always come from ROLE_NAV_ITEMS[role] — the exact, exhaustive list
 * per docs/product/NAVIGATION_BY_ROLE.md — so no code path in this
 * component can render an item outside that role's allowed set. This is
 * the concrete mechanism behind "navigation must never expose forbidden
 * actions": the data source itself has no forbidden items to draw from.
 *
 * Responsive pattern (docs/product/INFORMATION_ARCHITECTURE.md):
 * - Desktop (lg+, ~1440 reference): persistent labeled sidebar (SidebarNav).
 * - Tablet (sm–lg, ~834 reference): collapsible icon rail (TabletRailNav).
 * - Mobile (<sm, ~390 reference): bottom tab bar + "Lainnya" overflow sheet
 *   (MobileBottomNav).
 */
export function AppShell({ role, displayName, breadcrumbs, children }: AppShellProps) {
  const items = ROLE_NAV_ITEMS[role];

  return (
    <div className="flex min-h-screen flex-col">
      <ConsentGate />
      <Topbar
        displayName={displayName}
        role={role}
        homeHref={ROLE_HOME[role]}
        profileHref={ROLE_PROFILE[role]}
        notificationsHref={ROLES_WITH_NOTIFICATIONS[role]}
      />

      <div className="flex flex-1">
        <TabletRailNav items={items} />

        <aside className="hidden w-[280px] shrink-0 border-r border-brand-border bg-surface-container-lowest lg:block">
          <SidebarNav items={items} />
        </aside>

        <main className="flex-1 overflow-x-hidden px-4 pb-24 pt-4 sm:px-6 lg:px-10 lg:pb-10">
          {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}
          {children}
        </main>
      </div>

      <MobileBottomNav items={items} />
    </div>
  );
}
