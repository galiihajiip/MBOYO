"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn, roleLabels } from "@mboyo/ui";
import type { Role } from "@mboyo/domain";
import { NavIcon } from "./NavIcon";
import type { NavItem } from "../../lib/navigation/nav-items";

export interface SidebarNavProps {
  items: NavItem[];
  role: Role;
}

/**
 * Resolves which single nav item is "active" for the current path. A naive
 * per-item prefix match (pathname === href || pathname.startsWith(href + "/"))
 * marks EVERY item whose href is a path segment of the current URL as
 * active simultaneously — e.g. on /reporter/laporan/baru, both "Beranda"
 * (/reporter) and "Buat Laporan" (/reporter/laporan/baru) would match,
 * since /reporter/laporan/baru starts with "/reporter/" too. Only the
 * item with the LONGEST matching href should highlight, matching how a
 * user reads "which section am I in."
 */
function resolveActiveHref(pathname: string, items: { href: string }[]): string | null {
  let best: string | null = null;
  for (const item of items) {
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (matches && (best === null || item.href.length > best.length)) {
      best = item.href;
    }
  }
  return best;
}

/**
 * Desktop persistent sidebar (per docs/design/DESIGN_SYSTEM_SPEC.md
 * "Sidebar (Admin/Coord): Stacked navigation... 280px"). Renders exactly
 * the items passed in — since callers always pass
 * ROLE_NAV_ITEMS[role] (docs/product/NAVIGATION_BY_ROLE.md), this component
 * has no way to expose an item outside that per-role list, satisfying
 * "navigation must never expose forbidden actions" at the data-source level.
 */
export function SidebarNav({ items, role }: SidebarNavProps) {
  const pathname = usePathname();
  const activeHref = resolveActiveHref(pathname, items);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-brand-border px-4 py-4">
        <p className="font-sans text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          {roleLabels[role]}
        </p>
      </div>
      <nav aria-label="Navigasi utama" className="flex flex-1 flex-col gap-1 p-3">
        {items.map((item) => {
          const active = item.href === activeHref;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex min-h-11 items-center gap-3 rounded-lg px-3 font-sans text-sm font-semibold transition-colors",
                active
                  ? "bg-brand-signal-cyan text-brand-night shadow-sm"
                  : "text-on-surface-variant hover:bg-brand-mist hover:text-on-surface",
              )}
            >
              <NavIcon
                name={item.icon}
                className={cn(
                  "h-5 w-5 shrink-0",
                  active ? "text-brand-night" : "text-on-surface-variant group-hover:text-brand-signal-cyan",
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
