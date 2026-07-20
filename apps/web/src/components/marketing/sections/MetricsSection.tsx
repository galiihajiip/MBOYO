import { MetricCard } from "@mboyo/ui";

/**
 * "Metrics" section — per AGENTS.md ML honesty rules and
 * docs/product/SUCCESS_METRICS.md, this section names the metrics MBOYO
 * measures and commits to disclosing (macro-F1, destroyed recall,
 * calibration error, offline queue success, etc.) WITHOUT inventing
 * specific numbers before they exist. Metric cards show the metric name
 * and its measurement status, never a placeholder percentage.
 */
export function MetricsSection() {
  return (
    <section id="dampak" className="bg-surface-container-low py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-sans text-2xl font-bold text-on-surface sm:text-3xl">
            Metrik yang Kami Ukur — Bukan yang Kami Klaim
          </h2>
          <p className="mt-2 font-sans text-sm text-on-surface-variant">
            Kami tidak mempublikasikan angka akurasi sebelum diukur pada data uji yang belum
            pernah dilihat model. Berikut metrik yang secara konsisten kami laporkan setelah
            evaluasi nyata.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Tingkat Sukses Antrean Offline" value="Diukur per sesi" />
          <MetricCard label="Macro-F1 Model" value="Setelah evaluasi" />
          <MetricCard label="Recall Kelas 'Hancur Total'" value="Setelah evaluasi" />
          <MetricCard label="Reliabilitas Demo Langsung" value="Diukur per sesi" />
        </div>

        <p className="mt-6 text-center font-sans text-xs text-on-surface-variant">
          Metodologi pengukuran lengkap tersedia di{" "}
          <a href="/methodology" className="font-semibold text-brand-signal-cyan hover:underline">
            halaman Metodologi
          </a>
          .
        </p>
      </div>
    </section>
  );
}
