"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn, Sheet } from "@mboyo/ui";
import { NavIcon } from "./NavIcon";
import { MOBILE_BOTTOM_BAR_COUNT, type NavItem } from "../../lib/navigation/nav-items";

export interface MobileBottomNavProps {
  items: NavItem[];
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Mobile bottom tab bar — the first MOBILE_BOTTOM_BAR_COUNT items render as
 * large-icon tabs (per docs/design/DESIGN_SYSTEM_SPEC.md "Mobile Bottom
 * Nav: Large icons (32px)"); everything else (always including Profil)
 * goes in a "Lainnya" (More) overflow bottom sheet, per
 * docs/product/INFORMATION_ARCHITECTURE.md's responsive rule.
 */
export function MobileBottomNav({ items }: MobileBottomNavProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryItems = items.slice(0, MOBILE_BOTTOM_BAR_COUNT);
  const overflowItems = items.slice(MOBILE_BOTTOM_BAR_COUNT);

  return (
    <nav
      aria-label="Navigasi utama (seluler)"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-brand-border bg-surface-container-lowest lg:hidden"
    >
      {primaryItems.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2 font-sans text-[11px] font-medium",
              active ? "text-brand-ink-navy" : "text-on-surface-variant",
            )}
          >
            <NavIcon name={item.icon} className="h-6 w-6" />
            {item.label}
          </Link>
        );
      })}

      {overflowItems.length > 0 ? (
        <>
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            className="flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2 font-sans text-[11px] font-medium text-on-surface-variant"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-6 w-6">
              <circle cx="5" cy="12" r="1.6" fill="currentColor" />
              <circle cx="12" cy="12" r="1.6" fill="currentColor" />
              <circle cx="19" cy="12" r="1.6" fill="currentColor" />
            </svg>
            Lainnya
          </button>

          <Sheet open={moreOpen} onOpenChange={setMoreOpen} title="Lainnya">
            <div className="flex flex-col gap-1">
              {overflowItems.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-md px-3 font-sans text-sm font-medium",
                      active ? "bg-brand-mist text-brand-ink-navy" : "text-on-surface hover:bg-brand-mist",
                    )}
                  >
                    <NavIcon name={item.icon} className="h-5 w-5 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </Sheet>
        </>
      ) : null}
    </nav>
  );
}
