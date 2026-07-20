const FLOW_STEPS = [
  { step: "1", title: "Pelapor mengambil foto + lokasi", detail: "Sepenuhnya offline, tanpa menunggu koneksi." },
  { step: "2", title: "Laporan tersimpan di perangkat", detail: "Antrean lokal bertahan meski aplikasi ditutup atau dimuat ulang." },
  { step: "3", title: "Sinkronisasi otomatis saat online", detail: "Idempoten — tidak ada laporan ganda meski dicoba berulang." },
  { step: "4", title: "Analisis CV lokal", detail: "Model computer vision menghasilkan probabilitas tingkat keparahan." },
  { step: "5", title: "Verifikator meninjau bukti", detail: "Manusia memutuskan: konfirmasi, ubah klasifikasi, tolak, atau eskalasi." },
  { step: "6", title: "Koordinator menugaskan respons", detail: "Insiden terverifikasi diprioritaskan dan ditugaskan ke tim di lapangan." },
  { step: "7", title: "Auditor melihat jejak lengkap", detail: "Setiap langkah tercatat dan dapat ditelusuri — tanpa penghapusan." },
] as const;

/** "End-to-end flow" section — the full MVP live flow, step by step. */
export function FlowSection() {
  return (
    <section id="cara-kerja" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-sans text-2xl font-bold text-on-surface sm:text-3xl">Cara Kerja</h2>
        <p className="mt-2 font-sans text-sm text-on-surface-variant">
          Dari kamera pelapor hingga tugas respons di lapangan — satu alur yang dapat ditelusuri
          sepenuhnya.
        </p>
      </div>

      <ol className="mx-auto mt-10 flex max-w-3xl flex-col gap-4">
        {FLOW_STEPS.map((item) => (
          <li key={item.step} className="flex gap-4 rounded-lg border border-brand-border bg-surface-container-lowest p-4">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-ink-navy font-mono text-xs font-bold text-brand-cloud-white"
            >
              {item.step}
            </span>
            <div>
              <p className="font-sans text-sm font-semibold text-on-surface">{item.title}</p>
              <p className="mt-1 font-sans text-sm text-on-surface-variant">{item.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
