const PILLARS = [
  { title: "Offline-first, bukan offline-toleran", body: "Pembuatan laporan tidak pernah bergantung pada ketersediaan jaringan." },
  { title: "Manusia tetap memutuskan", body: "Computer vision membantu triase, namun klasifikasi akhir selalu oleh Verifikator." },
  { title: "Wewenang yang terpisah jelas", body: "Lima peran dengan kapabilitas berbeda — tidak ada tumpang tindih tersembunyi." },
  { title: "Dapat diaudit sepenuhnya", body: "Setiap transisi status tercatat dan terlihat oleh Auditor tanpa rekonstruksi manual." },
];

/** "Solusi" section — the four product pillars from docs/product/PRODUCT_CHARTER.md. */
export function SolutionSection() {
  return (
    <section id="solusi" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-sans text-2xl font-bold text-on-surface sm:text-3xl">
          Satu Platform, Empat Prinsip
        </h2>
      </div>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {PILLARS.map((pillar) => (
          <div key={pillar.title} className="rounded-lg border border-brand-border bg-surface-container-lowest p-6">
            <h3 className="font-sans text-base font-semibold text-on-surface">{pillar.title}</h3>
            <p className="mt-2 font-sans text-sm text-on-surface-variant">{pillar.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
