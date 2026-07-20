import Link from "next/link";

/**
 * Hero section — tagline, explanation of the offline-first → sync → CV
 * triage → human verification → command coordination flow, primary CTA
 * "Buat Laporan" and secondary "Lihat Demo Command Center". No stock
 * photography — the illustration is an original SVG pipeline diagram
 * (see HeroPipelineDiagram) built from brand tokens, matching the "no
 * external stock-photo dependency" requirement.
 */
export function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-10 lg:py-28">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div className="flex flex-col gap-6">
          <h1 className="font-sans text-3xl font-bold leading-tight text-on-surface sm:text-4xl lg:text-[44px] lg:leading-[52px]">
            Laporan Tetap Jalan. Respons Lebih Tepat.
          </h1>
          <p className="font-sans text-base leading-7 text-on-surface-variant sm:text-lg">
            MBOYO memungkinkan pelapor mengambil foto dan lokasi kejadian sepenuhnya{" "}
            <strong className="text-on-surface">offline</strong>, lalu menyinkronkannya secara{" "}
            <strong className="text-on-surface">otomatis</strong> begitu koneksi tersedia. Setiap
            laporan dianalisis oleh model computer vision lokal untuk triase awal, namun keputusan
            akhir selalu berada di tangan{" "}
            <strong className="text-on-surface">verifikator manusia</strong> — sebelum tim
            koordinasi mengelola respons secara geospasial dari satu command center.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/masuk?next=%2Fpelapor%2Flaporan%2Fbaru"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand-ink-navy px-6 font-sans text-base font-semibold text-brand-cloud-white hover:bg-brand-deep-ocean"
            >
              Buat Laporan
            </Link>
            <a
              href="#akun-demo"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-brand-border bg-surface-container-lowest px-6 font-sans text-base font-semibold text-on-surface hover:bg-brand-mist"
            >
              Lihat Demo Command Center
            </a>
          </div>
        </div>

        <HeroPipelineDiagram />
      </div>
    </section>
  );
}

/**
 * Original SVG diagram (no external image dependency) illustrating the
 * offline → sync → CV triage → verification → coordination pipeline,
 * matching the MVP live flow in docs/product/PRODUCT_CHARTER.md.
 */
function HeroPipelineDiagram() {
  const steps = [
    { label: "Foto + GPS Offline", color: "var(--color-brand-muted)" },
    { label: "Sinkronisasi Otomatis", color: "var(--color-brand-signal-cyan)" },
    { label: "Triase CV Lokal", color: "var(--color-brand-caution-amber)" },
    { label: "Verifikasi Manusia", color: "var(--color-brand-relief-teal)" },
    { label: "Koordinasi Respons", color: "var(--color-brand-safe-green)" },
  ];

  return (
    <div
      role="img"
      aria-label="Diagram alur: Foto dan GPS offline, lalu sinkronisasi otomatis, triase computer vision lokal, verifikasi manusia, dan koordinasi respons."
      className="flex flex-col gap-3 rounded-xl border border-brand-border bg-surface-container-lowest p-6 shadow-[0_8px_24px_rgba(8,32,50,0.08)]"
    >
      {steps.map((step, index) => (
        <div key={step.label} className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold text-brand-cloud-white"
            style={{ backgroundColor: step.color }}
          >
            {index + 1}
          </span>
          <span className="font-sans text-sm font-medium text-on-surface">{step.label}</span>
          {index < steps.length - 1 ? (
            <span aria-hidden="true" className="ml-auto text-on-surface-variant">
              &darr;
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
