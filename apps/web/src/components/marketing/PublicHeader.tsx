"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "#solusi", label: "Solusi" },
  { href: "#cara-kerja", label: "Cara Kerja" },
  { href: "#teknologi", label: "Teknologi" },
  { href: "#dampak", label: "Dampak" },
  { href: "#keamanan-data", label: "Keamanan Data" },
] as const;

/**
 * Public marketing header — interactive anchor navigation with smooth scrolling
 * for Solusi, Cara Kerja, Teknologi, Dampak, and Keamanan Data.
 */
export function PublicHeader() {
  const pathname = usePathname();

  function handleNavClick(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    const targetId = href.replace("#", "");
    if (pathname === "/") {
      e.preventDefault();
      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        window.history.pushState(null, "", href);
        window.dispatchEvent(new Event("hashchange"));
      }
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-brand-border bg-surface-container-lowest/95 backdrop-blur shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
        <Link href="/" className="flex items-center gap-2.5" aria-label="MBOYO — Beranda">
          <Image src="/icons/logo.svg" alt="" width={36} height={36} priority />
          <span className="font-sans text-xl font-extrabold tracking-tight text-on-surface">MBOYO</span>
        </Link>

        <nav aria-label="Navigasi utama" className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={pathname === "/" ? link.href : `/${link.href}`}
              onClick={(e) => handleNavClick(e, link.href)}
              className="font-sans text-sm font-semibold text-on-surface-variant transition-colors hover:text-brand-signal-cyan"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/masuk"
            className="hidden min-h-11 items-center rounded-lg px-4 font-sans text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-low sm:inline-flex"
          >
            Masuk
          </Link>
          <Link
            href="/masuk?next=%2Freporter%2Flaporan%2Fbaru"
            className="inline-flex min-h-11 items-center rounded-xl bg-brand-ink-navy px-4 font-sans text-sm font-bold text-white shadow-md transition-colors hover:bg-brand-deep-ocean"
          >
            Laporkan Kerusakan
          </Link>
        </div>
      </div>
    </header>
  );
}
