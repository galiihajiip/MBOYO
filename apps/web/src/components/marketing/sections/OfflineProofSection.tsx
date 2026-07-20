import { SyncStatus, OnlineStatus } from "@mboyo/ui";

const PROOF_POINTS = [
  "Laporan disimpan di IndexedDB perangkat — tidak pernah menunggu jaringan untuk tersimpan.",
  "Antrean bertahan meski halaman dimuat ulang atau aplikasi ditutup sepenuhnya.",
  "Background Sync menyinkronkan otomatis begitu koneksi kembali, tanpa aksi pengguna.",
  "Sinkronisasi bersifat idempoten — percobaan ulang tidak pernah menghasilkan laporan ganda.",
];

/**
 * "Offline proof" section — demonstrates the offline-first guarantees using
 * the actual OnlineStatus/SyncStatus UI primitives a Reporter would see,
 * rather than a marketing illustration divorced from the real product.
 */
export function OfflineProofSection() {
  return (
    <section id="offline-proof" className="bg-surface-container-low py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="font-sans text-2xl font-bold text-on-surface sm:text-3xl">
              Offline Bukan Sekadar Klaim
            </h2>
            <ul className="mt-6 flex flex-col gap-3">
              {PROOF_POINTS.map((point) => (
                <li key={point} className="flex gap-3">
                  <span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-signal-cyan" />
                  <span className="font-sans text-sm text-on-surface-variant">{point}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-4 rounded-xl border border-brand-border bg-surface-container-lowest p-6 shadow-[0_8px_24px_rgba(8,32,50,0.08)]">
            <p className="font-sans text-xs font-bold uppercase tracking-wide text-on-surface-variant">
              Status yang Terlihat Langsung di Aplikasi
            </p>
            <div className="flex flex-wrap gap-3">
              <OnlineStatus online={false} />
              <SyncStatus state="queued" pendingCount={3} />
            </div>
            <div className="flex flex-wrap gap-3">
              <OnlineStatus online={true} />
              <SyncStatus state="synced" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
