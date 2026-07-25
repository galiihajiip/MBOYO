import Link from "next/link";

/**
 * Redesigned CtaBanner — High-impact 3D glassmorphism CTA card container.
 * Zero em-dashes (—) and zero emojis.
 */
export function CtaBanner() {
  return (
    <section className="bg-surface-container-low/70 py-12 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#06141f] via-[#082032] to-[#0b3a53] p-8 text-white shadow-2xl sm:p-12 border border-brand-signal-cyan/30">
          {/* Ambient Glow Effects */}
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-brand-signal-cyan/15 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -left-20 -bottom-20 h-80 w-80 rounded-full bg-brand-caution-amber/10 blur-3xl"
            aria-hidden="true"
          />

          <div className="relative z-10 flex flex-col items-center justify-between gap-8 text-center lg:flex-row lg:text-left">
            <div className="flex flex-col gap-3 lg:max-w-2xl">
              <span className="inline-flex self-center items-center gap-2 rounded-full border border-brand-signal-cyan/40 bg-brand-signal-cyan/10 px-3.5 py-1 font-mono text-xs font-semibold text-brand-signal-cyan lg:self-start">
                <svg className="h-3.5 w-3.5 text-brand-signal-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                SIAP UNTUK SITUASI DARURAT BENCANA
              </span>

              <h2 className="font-sans text-2xl font-extrabold text-white sm:text-3xl lg:text-4xl">
                Laporan Bencana Tetap Terkirim: Tanpa Bergantung pada Sinyal Seluler.
              </h2>
              <p className="font-sans text-sm text-slate-300 sm:text-base">
                MBOYO siap membantu warga, verifikator, dan koordinator di seluruh wilayah Indonesia merespons bencana dengan cepat dan tepat.
              </p>
            </div>

            <div className="flex flex-col gap-3.5 sm:flex-row shrink-0 w-full sm:w-auto justify-center">
              <Link
                href="/masuk?next=%2Fpelapor%2Flaporan%2Fbaru"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-caution-amber px-6 font-sans text-base font-bold text-brand-ink-navy shadow-lg shadow-brand-caution-amber/20 transition-all hover:bg-amber-400"
              >
                <span>Buat Laporan</span>
                <span aria-hidden="true">&rarr;</span>
              </Link>
              <a
                href="#akun-demo"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 font-sans text-base font-semibold text-white backdrop-blur transition-all hover:bg-white/10"
              >
                <span>Uji Akun Demo</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
