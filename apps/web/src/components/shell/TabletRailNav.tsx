"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@mboyo/ui";
import { NavIcon } from "./NavIcon";
import type { NavItem } from "../../lib/navigation/nav-items";

export interface TabletRailNavProps {
  items: NavItem[];
}

/**
 * See SidebarNav.tsx's identical helper for the full rationale: a naive
 * per-item prefix match marks every href that's a path segment of the
 * current URL as active simultaneously — only the longest matching href
 * should highlight.
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
 * Tablet collapsible icon rail — per
 * docs/product/INFORMATION_ARCHITECTURE.md: "collapsible left sidebar
 * (icon-only by default, expandable)". Visible only at the tablet
 * breakpoint (hidden below lg on mobile, where MobileBottomNav takes over;
 * hidden at lg+ where SidebarNav's full labeled sidebar takes over).
 */
export function TabletRailNav({ items }: TabletRailNavProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const activeHref = resolveActiveHref(pathname, items);

  return (
    <nav
      aria-label="Navigasi utama (tablet)"
      className={cn(
        "hidden shrink-0 border-r border-brand-border bg-surface-container-lowest transition-[width] sm:flex lg:hidden",
        expanded ? "w-56" : "w-16",
      )}
    >
      <div className="flex w-full flex-col gap-1 p-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Ciutkan navigasi" : "Perluas navigasi"}
          aria-expanded={expanded}
          className="mb-1 flex min-h-11 w-11 items-center justify-center rounded-md text-on-surface-variant hover:bg-brand-mist"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
            <path
              d={expanded ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"}
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {items.map((item) => {
          const active = item.href === activeHref;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              title={expanded ? undefined : item.label}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-md px-3 font-sans text-sm font-medium",
                active
                  ? "bg-brand-mist text-brand-ink-navy"
                  : "text-on-surface-variant hover:bg-brand-mist hover:text-on-surface",
              )}
            >
              <NavIcon name={item.icon} className="h-5 w-5 shrink-0" />
              {expanded ? <span className="truncate">{item.label}</span> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
