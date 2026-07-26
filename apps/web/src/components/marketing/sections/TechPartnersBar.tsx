/**
 * TechPartnersBar — Inspired by modern corporate landing pages (Hornet & SwiftLogistics reference),
 * displaying the core technological foundation of MBOYO using clean badges & brand tokens.
 */
export function TechPartnersBar() {
  const technologies = [
    { name: "Next.js 16 App Router", category: "Aplikasi Web & HP" },
    { name: "Supabase & PostGIS", category: "Basis Data & Peta" },
    { name: "FastAPI & ONNX Runtime", category: "Mesin AI Penilai Kerusakan" },
    { name: "Tailwind CSS 4", category: "Tampilan Antarmuka" },
    { name: "Dexie.js & IndexedDB", category: "Penyimpanan di HP" },
    { name: "Sentry Observability", category: "Pemantau Error" },
  ];

  return (
    <div className="border-y border-brand-border bg-surface-container-low py-6">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10">
        <p className="text-center font-sans text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Dibangun dengan Teknologi yang Sudah Terbukti Andal
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 sm:gap-6">
          {technologies.map((tech) => (
            <div
              key={tech.name}
              className="flex items-center gap-2 rounded-lg border border-brand-border bg-surface-container-lowest px-3 py-1.5 shadow-sm transition-all hover:border-brand-signal-cyan/60"
            >
              <span className="h-2 w-2 rounded-full bg-brand-signal-cyan" aria-hidden="true" />
              <span className="font-sans text-xs font-semibold text-on-surface">{tech.name}</span>
              <span className="font-mono text-[10px] text-on-surface-variant">({tech.category})</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
