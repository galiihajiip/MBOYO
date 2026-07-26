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
      { href: "#keamanan-data", label: "Keamanan Data" },
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
 * Public marketing footer — Dark Navy Theme matching landing page alternating rhythm.
 */
export function PublicFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#040e16] text-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-10">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.heading} className="flex flex-col gap-3">
              <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-brand-signal-cyan">
                {column.heading}
              </h3>
              <ul className="flex flex-col gap-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="font-sans text-sm text-slate-300 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="flex flex-col gap-3">
            <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-brand-caution-amber">
              Status
            </h3>
            <p className="font-sans text-xs leading-relaxed text-slate-300">
              Status layanan publik belum tersedia: kesehatan sistem saat ini dipantau secara
              internal oleh Administrator Sistem.
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-sans text-xs text-slate-400">
            MBOYO: dikembangkan oleh VETERAN KUKUS.
          </p>
          <p className="font-mono text-xs text-slate-400">
            &copy; {new Date().getFullYear()} Tim VETERAN KUKUS. Hak Cipta Dilindungi.
          </p>
        </div>
      </div>
    </footer>
  );
}
