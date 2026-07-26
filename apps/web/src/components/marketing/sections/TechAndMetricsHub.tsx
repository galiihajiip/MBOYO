import Link from "next/link";

const STACK_LAYERS = [
  {
    layer: "Aplikasi & Antarmuka",
    why: "Bisa dibuka langsung dari browser HP tanpa install dari app store — penting karena warga sering tidak sempat atau tidak bisa unduh aplikasi baru saat sinyal terbatas.",
    items: ["Next.js App Router (PWA)", "Dexie / IndexedDB", "Workbox Background Sync"],
  },
  {
    layer: "Data & Platform",
    why: "Punya dukungan bawaan untuk data lokasi (peta), jadi pengelompokan laporan berdasarkan lokasi bisa langsung dilakukan di database, bukan dihitung manual satu-satu.",
    items: ["Supabase Auth", "Postgres + PostGIS", "Storage Privat & Realtime"],
  },
  {
    layer: "Kecerdasan Buatan",
    why: "Model AI berjalan di server kami sendiri, bukan dikirim ke layanan pihak ketiga — hasil penilaian bisa dievaluasi ulang dan diaudit kapan saja.",
    items: ["FastAPI & ONNX Runtime", "Model Registry & Evaluasi Terukur"],
  },
];

/**
 * TechAndMetricsHub — Side-by-side 2-column card layout combining Technology Architecture and Disclosed Metrics.
 * Zero em-dashes (—).
 */
export function TechAndMetricsHub() {
  return (
    <section id="teknologi" className="bg-surface-container-low/70 py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Column 1: Technology Stack */}
          <div className="flex flex-col justify-between rounded-3xl border border-brand-border bg-surface-container-lowest p-6 shadow-lg sm:p-8">
            <div>
              <span className="font-mono text-xs font-bold text-brand-signal-cyan uppercase tracking-wider">
                DI BALIK LAYAR
              </span>
              <h3 className="mt-2 font-sans text-2xl font-extrabold text-on-surface">
                Teknologi yang Kami Pakai
              </h3>
              <p className="mt-2 font-sans text-sm text-on-surface-variant">
                Dipilih supaya tetap bisa diandalkan saat dipakai langsung di lokasi bencana, bukan cuma lancar
                waktu didemokan di kantor.
              </p>

              <div className="mt-6 flex flex-col gap-4">
                {STACK_LAYERS.map((layer) => (
                  <div key={layer.layer} className="rounded-xl border border-brand-border/60 bg-surface-container-low p-4">
                    <h4 className="font-sans text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                      {layer.layer}
                    </h4>
                    <p className="mt-1 font-sans text-xs leading-relaxed text-on-surface-variant">
                      {layer.why}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {layer.items.map((item) => (
                        <span key={item} className="rounded-md border border-brand-border bg-surface-container-lowest px-2.5 py-1 font-mono text-xs text-on-surface">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Column 2: Evaluated Metrics (Anchor: #dampak) */}
          <div id="dampak" className="flex flex-col justify-between rounded-3xl border border-brand-border bg-surface-container-lowest p-6 shadow-lg sm:p-8">
            <div>
              <span className="font-mono text-xs font-bold text-brand-safe-green uppercase tracking-wider">
                KAMI TIDAK KARANG ANGKA
              </span>
              <h3 className="mt-2 font-sans text-2xl font-extrabold text-on-surface">
                Metrik MBOYO Sendiri: Jujur Apa Adanya
              </h3>
              <p className="mt-2 font-sans text-sm text-on-surface-variant">
                Kami tidak akan memasang angka akurasi sebelum benar-benar diukur pada data uji yang belum
                pernah dilihat sistemnya. Di bawah ini metrik yang sedang kami kumpulkan, apa adanya.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-brand-border bg-surface-container-low p-4">
                  <span className="font-sans text-xs font-bold text-on-surface">Tingkat Sukses Antrean Offline</span>
                  <p className="mt-1 font-sans text-[11px] text-on-surface-variant">Berapa persen laporan offline yang berhasil terkirim tanpa gagal.</p>
                  <p className="mt-1 font-mono text-xs text-brand-safe-green font-semibold">Diukur per sesi</p>
                </div>

                <div className="rounded-xl border border-brand-border bg-surface-container-low p-4">
                  <span className="font-sans text-xs font-bold text-on-surface">Macro-F1 Model</span>
                  <p className="mt-1 font-sans text-[11px] text-on-surface-variant">Seberapa akurat AI menebak tingkat kerusakan, dirata-rata adil di semua kategori.</p>
                  <p className="mt-1 font-mono text-xs text-brand-signal-cyan font-semibold">Setelah evaluasi</p>
                </div>

                <div className="rounded-xl border border-brand-border bg-surface-container-low p-4">
                  <span className="font-sans text-xs font-bold text-on-surface">Recall Kelas Hancur Total</span>
                  <p className="mt-1 font-sans text-[11px] text-on-surface-variant">Seberapa sering AI berhasil menangkap kasus kerusakan paling parah, bukan malah melewatkannya.</p>
                  <p className="mt-1 font-mono text-xs text-brand-critical-red font-semibold">Setelah evaluasi</p>
                </div>

                <div className="rounded-xl border border-brand-border bg-surface-container-low p-4">
                  <span className="font-sans text-xs font-bold text-on-surface">Reliabilitas Demo Langsung</span>
                  <p className="mt-1 font-sans text-[11px] text-on-surface-variant">Berapa persen sesi demo yang berjalan lancar tanpa bantuan manual di belakang layar.</p>
                  <p className="mt-1 font-mono text-xs text-brand-caution-amber font-semibold">Diukur per sesi</p>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-brand-border/60 pt-4 font-sans text-xs text-on-surface-variant">
              Metodologi pengukuran lengkap tersedia di{" "}
              <Link href="/methodology" className="font-bold text-brand-signal-cyan hover:underline">
                halaman Metodologi &rarr;
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
