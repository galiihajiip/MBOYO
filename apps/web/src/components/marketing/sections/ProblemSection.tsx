const PROBLEMS = [
  {
    title: "Konektivitas terputus tepat saat dibutuhkan",
    body: "Bencana sering merusak jaringan seluler lebih dulu — alat pelaporan yang mengharuskan koneksi langsung gagal justru di momen paling kritis.",
  },
  {
    title: "Triase manual tidak dapat mengejar volume laporan",
    body: "Tanpa bantuan computer vision, tim verifikasi kewalahan menyaring laporan yang membanjir, sementara laporan prioritas tinggi bisa tertunda.",
  },
  {
    title: "Keputusan otomatis tanpa akuntabilitas manusia",
    body: "Sistem klasifikasi berbasis AI murni berisiko salah menilai kerusakan tanpa verifikasi manusia — MBOYO menempatkan manusia sebagai pengambil keputusan akhir.",
  },
];

/** "Problem" section — the disaster-reporting gap MBOYO addresses. */
export function ProblemSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-sans text-2xl font-bold text-on-surface sm:text-3xl">
          Pelaporan bencana yang ada belum siap untuk kondisi nyata
        </h2>
      </div>
      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {PROBLEMS.map((problem) => (
          <div
            key={problem.title}
            className="rounded-lg border border-brand-border bg-surface-container-lowest p-6"
          >
            <h3 className="font-sans text-base font-semibold text-on-surface">{problem.title}</h3>
            <p className="mt-2 font-sans text-sm text-on-surface-variant">{problem.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
