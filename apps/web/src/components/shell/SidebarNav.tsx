"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@mboyo/ui";
import { NavIcon } from "./NavIcon";
import type { NavItem } from "../../lib/navigation/nav-items";

export interface SidebarNavProps {
  items: NavItem[];
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Desktop persistent sidebar (per docs/design/DESIGN_SYSTEM_SPEC.md
 * "Sidebar (Admin/Coord): Stacked navigation... 280px"). Renders exactly
 * the items passed in — since callers always pass
 * ROLE_NAV_ITEMS[role] (docs/product/NAVIGATION_BY_ROLE.md), this component
 * has no way to expose an item outside that per-role list, satisfying
 * "navigation must never expose forbidden actions" at the data-source level.
 */
export function SidebarNav({ items }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigasi utama" className="flex flex-col gap-1 p-3">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-md px-3 font-sans text-sm font-medium",
              active
                ? "bg-brand-mist text-brand-ink-navy"
                : "text-on-surface-variant hover:bg-brand-mist hover:text-on-surface",
            )}
          >
            <NavIcon name={item.icon} className="h-5 w-5 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
