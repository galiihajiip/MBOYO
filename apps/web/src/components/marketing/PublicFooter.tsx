import Link from "next/link";

interface FooterColumn {
  heading: string;
  links: { href: string; label: string; external?: boolean }[];
}

const FOOTER_COLUMNS: FooterColumn[] = [
  {
    heading: "Produk",
    links: [
      { href: "#solusi", label: "Solusi" },
      { href: "#cara-kerja", label: "Cara Kerja" },
      { href: "#dampak", label: "Dampak" },
      { href: "#akun-demo", label: "Akun Demo" },
    ],
  },
  {
    heading: "Navigasi",
    links: [
      { href: "/", label: "Beranda" },
      { href: "/masuk", label: "Masuk" },
      { href: "#faq", label: "FAQ" },
    ],
  },
  {
    heading: "Teknologi",
    links: [
      { href: "#teknologi", label: "Arsitektur & Stack" },
      { href: "#offline-proof", label: "Bukti Offline-First" },
      { href: "#ai-manusia", label: "AI + Verifikasi Manusia" },
      { href: "#koordinasi-geospasial", label: "Koordinasi Geospasial" },
    ],
  },
  {
    heading: "Kepercayaan",
    links: [
      { href: "/privacy", label: "Kebijakan Privasi" },
      { href: "/methodology", label: "Metodologi" },
      { href: "/data-governance", label: "Tata Kelola Data" },
      { href: "/accessibility", label: "Aksesibilitas" },
    ],
  },
];

/**
 * Public marketing footer — per this block's spec: product, navigation,
 * technology, privacy, methodology, accessibility, status, team
 * attribution. Status is a distinct link (service-health page is out of
 * scope for this block; links to the closest existing concept —
 * documented System Administrator health visibility — until a public
 * status page exists) rather than fabricated.
 */
export function PublicFooter() {
  return (
    <footer className="border-t border-brand-border bg-surface-container-low">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-10">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.heading} className="flex flex-col gap-3">
              <h3 className="font-sans text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                {column.heading}
              </h3>
              <ul className="flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="font-sans text-sm text-on-surface hover:text-brand-signal-cyan"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="flex flex-col gap-3">
            <h3 className="font-sans text-xs font-bold uppercase tracking-wide text-on-surface-variant">
              Status
            </h3>
            <p className="font-sans text-sm text-on-surface-variant">
              Status layanan publik belum tersedia — kesehatan sistem saat ini dipantau secara
              internal oleh Administrator Sistem.
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-brand-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-sans text-xs text-on-surface-variant">
            MBOYO — dikembangkan untuk PIDI Digdaya × Hackathon Bank Indonesia 2026.
          </p>
          <p className="font-mono text-xs text-on-surface-variant">
            &copy; {new Date().getFullYear()} Tim MBOYO
          </p>
        </div>
      </div>
    </footer>
  );
}
