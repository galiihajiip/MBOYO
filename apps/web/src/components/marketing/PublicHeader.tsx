import Image from "next/image";
import Link from "next/link";

const NAV_LINKS = [
  { href: "#solusi", label: "Solusi" },
  { href: "#cara-kerja", label: "Cara Kerja" },
  { href: "#teknologi", label: "Teknologi" },
  { href: "#dampak", label: "Dampak" },
  { href: "#keamanan-data", label: "Keamanan Data" },
] as const;

/**
 * Public marketing header — per this block's spec: MBOYO wordmark, the five
 * section-anchor nav links, "Masuk" (login), and the primary CTA
 * "Laporkan Kerusakan". Distinct from the authenticated app shell's nav
 * (docs/product/NAVIGATION_BY_ROLE.md) — this header only ever appears on
 * public/marketing routes.
 */
export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-brand-border bg-surface-container-lowest/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
        <Link href="/" className="flex items-center gap-2" aria-label="MBOYO — Beranda">
          <Image src="/icons/logo.svg" alt="" width={32} height={32} priority />
          <span className="font-sans text-lg font-bold text-on-surface">MBOYO</span>
        </Link>

        <nav aria-label="Navigasi utama" className="hidden items-center gap-6 lg:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="font-sans text-sm font-medium text-on-surface-variant hover:text-on-surface"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/masuk"
            className="hidden min-h-11 items-center rounded-md px-3 font-sans text-sm font-semibold text-on-surface hover:bg-brand-mist sm:inline-flex"
          >
            Masuk
          </Link>
          <Link
            href="/masuk?next=%2Fpelapor%2Flaporan%2Fbaru"
            className="inline-flex min-h-11 items-center rounded-md bg-brand-ink-navy px-4 font-sans text-sm font-semibold text-brand-cloud-white hover:bg-brand-deep-ocean"
          >
            Laporkan Kerusakan
          </Link>
        </div>
      </div>
    </header>
  );
}
