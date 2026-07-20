import { ProbabilityBars } from "@mboyo/ui";

/**
 * "AI + human" section — demonstrates that model output is advisory input
 * to a human Verifier, never an autonomous decision, per
 * docs/product/PRODUCT_CHARTER.md's "human-in-the-loop verification" pillar
 * and AGENTS.md ML honesty rules. Uses the real ProbabilityBars component
 * with representative (clearly labeled as illustrative) values — no
 * fabricated accuracy claim appears anywhere in this section.
 */
export function AiHumanSection() {
  return (
    <section id="ai-manusia" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-10">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <h2 className="font-sans text-2xl font-bold text-on-surface sm:text-3xl">
            AI Menyaring, Manusia Memutuskan
          </h2>
          <p className="mt-4 font-sans text-sm leading-6 text-on-surface-variant">
            Model computer vision lokal menghasilkan probabilitas tingkat keparahan untuk setiap
            laporan — sinyal awal yang membantu Verifikator memprioritaskan peninjauan. Model tidak
            pernah membuat keputusan akhir: setiap laporan tetap memerlukan konfirmasi, koreksi,
            atau penolakan dari Verifikator manusia sebelum menjadi insiden terverifikasi.
          </p>
          <p className="mt-4 font-sans text-sm leading-6 text-on-surface-variant">
            Jika model belum memenuhi ambang evaluasi yang ditetapkan, hasilnya ditandai sebagai{" "}
            <strong className="text-on-surface">saran, bukan keputusan</strong> — Verifikator tetap
            melakukan tinjauan manual penuh.
          </p>
        </div>

        <div className="rounded-xl border border-brand-border bg-surface-container-lowest p-6 shadow-[0_8px_24px_rgba(8,32,50,0.08)]">
          <p className="font-sans text-xs font-bold uppercase tracking-wide text-on-surface-variant">
            Contoh Ilustratif — Probabilitas Tingkat Keparahan
          </p>
          <p className="mt-1 font-sans text-xs text-on-surface-variant">
            Nilai di bawah ini adalah data ilustrasi untuk keperluan demonstrasi, bukan hasil model
            sungguhan.
          </p>
          <div className="mt-4">
            <ProbabilityBars
              probabilities={{
                unknown: 0.02,
                no_damage: 0.05,
                minor_damage: 0.18,
                major_damage: 0.55,
                destroyed: 0.2,
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
