"use client";

import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { roleLabels } from "@mboyo/ui";
import type { Role } from "@mboyo/domain";

export interface UserMenuProps {
  displayName: string;
  role: Role;
  profileHref: string;
}

export function UserMenu({ displayName, role, profileHref }: UserMenuProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } catch {}
    window.location.href = "/masuk";
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex min-h-11 items-center gap-2 rounded-md px-2 font-sans text-sm font-medium text-on-surface hover:bg-brand-mist"
        >
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-ink-navy font-sans text-xs font-bold text-brand-cloud-white"
          >
            {displayName.slice(0, 1).toUpperCase()}
          </span>
          <span className="hidden sm:inline">{displayName}</span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-48 rounded-md border border-brand-border bg-surface-container-lowest p-1 shadow-lg"
        >
          <div className="px-3 py-2">
            <p className="font-sans text-sm font-semibold text-on-surface">{displayName}</p>
            <p className="font-sans text-xs text-on-surface-variant">{roleLabels[role]}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-brand-border" />
          <DropdownMenu.Item asChild>
            <Link
              href={profileHref}
              className="flex min-h-11 cursor-pointer items-center rounded-sm px-3 font-sans text-sm text-on-surface outline-none data-[highlighted]:bg-brand-mist"
            >
              Profil
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={isSigningOut}
              className="flex min-h-11 w-full cursor-pointer items-center rounded-sm px-3 text-left font-sans text-sm text-brand-critical-red outline-none data-[highlighted]:bg-brand-mist disabled:opacity-50"
            >
              {isSigningOut ? "Keluar..." : "Keluar"}
            </button>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
