const PILLARS = [
  {
    title: "1. Pelaporan Offline-First",
    badge: "IndexedDB PWA",
    body: "Pembuatan laporan foto & lokasi GPS 100% tidak pernah bergantung pada sinyal seluler. Laporan tersimpan di IndexedDB perangkat hingga koneksi pulih.",
    icon: (
      <svg className="h-6 w-6 text-brand-signal-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    cardColor: "border-brand-signal-cyan/30 bg-surface-container-lowest hover:border-brand-signal-cyan",
  },
  {
    title: "2. Triase Vision AI Lokal",
    badge: "FastAPI ONNX",
    body: "Model AI lokal menganalisis foto kerusakan bangunan (<500ms) untuk mengkategorikan tingkat keparahan awal & deteksi duplikasi gambar secara otomatis.",
    icon: (
      <svg className="h-6 w-6 text-brand-caution-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 01-2 2h- Red 0 01-2-2v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    cardColor: "border-brand-caution-amber/30 bg-surface-container-lowest hover:border-brand-caution-amber",
  },
  {
    title: "3. Verifikasi Berbasis Manusia",
    badge: "Human-in-Loop",
    body: "AI hanya membantu triase — keputusan akhir konfirmasi, revisi, penolakan, atau eskalasi selalu berada di tangan Petugas Verifikator yang berwenang.",
    icon: (
      <svg className="h-6 w-6 text-brand-relief-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    cardColor: "border-brand-relief-teal/30 bg-surface-container-lowest hover:border-brand-relief-teal",
  },
  {
    title: "4. Command Center Geospasial",
    badge: "PostGIS Bounds",
    body: "Peta krisis realtime dengan klasterisasi insiden otomatis & penugasan tim respons lapangan berdasarkan tingkat prioritas operasional.",
    icon: (
      <svg className="h-6 w-6 text-brand-safe-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
    cardColor: "border-brand-safe-green/30 bg-surface-container-lowest hover:border-brand-safe-green",
  },
];

/** Redesigned SolutionSection (Gambar 2) — 3D cards, professional SVG icons (no emojis!). */
export function SolutionSection() {
  return (
    <section id="solusi" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-10">
      <div className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-signal-cyan/40 bg-brand-signal-cyan/10 px-3.5 py-1 font-mono text-xs font-bold text-brand-signal-cyan">
          SOLUSI ARSITEKTUR
        </span>
        <h2 className="mt-3 font-sans text-2xl font-extrabold text-on-surface sm:text-3xl lg:text-4xl">
          Empat Pilar Tanggap Bencana MBOYO
        </h2>
        <p className="mt-3 font-sans text-base text-on-surface-variant">
          Dirancang dari dasar untuk menjamin keandalan saat darurat — menghubungkan warga, AI, verifikator, dan command center.
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {PILLARS.map((pillar) => (
          <div
            key={pillar.title}
            className={`group relative flex flex-col justify-between rounded-2xl border p-6 shadow-[0_12px_30px_rgba(8,32,50,0.06)] transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_22px_45px_rgba(8,32,50,0.12)] ${pillar.cardColor}`}
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container-low shadow-sm border border-brand-border group-hover:scale-110 transition-transform">
                  {pillar.icon}
                </div>
                <span className="rounded-full border border-brand-border bg-surface-container-low px-2.5 py-1 font-mono text-[10px] font-bold text-on-surface-variant">
                  {pillar.badge}
                </span>
              </div>

              <h3 className="mt-5 font-sans text-base font-bold text-on-surface group-hover:text-brand-ink-navy">
                {pillar.title}
              </h3>
              <p className="mt-2 font-sans text-sm leading-relaxed text-on-surface-variant">
                {pillar.body}
              </p>
            </div>

            <div className="mt-6 flex items-center gap-1.5 border-t border-brand-border/60 pt-4 font-mono text-xs font-bold text-brand-ink-navy group-hover:text-brand-signal-cyan">
              <span>Fitur Terintegrasi</span>
              <span aria-hidden="true">&rarr;</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
