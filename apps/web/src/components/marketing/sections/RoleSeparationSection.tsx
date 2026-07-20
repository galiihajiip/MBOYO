import { RoleBadge } from "@mboyo/ui";
import type { Role } from "@mboyo/domain";

const ROLES: { role: Role; description: string }[] = [
  { role: "reporter", description: "Membuat dan memantau laporan sendiri — tidak dapat melihat laporan pelapor lain." },
  { role: "verifier", description: "Meninjau bukti, kualitas, duplikasi, dan probabilitas model — memutuskan klasifikasi akhir." },
  { role: "response_coordinator", description: "Menentukan prioritas dan menugaskan tim respons atas insiden yang sudah terverifikasi." },
  { role: "system_administrator", description: "Mengelola pengguna, event, dan pengaturan sistem — tidak dapat memvalidasi atau menugaskan." },
  { role: "auditor", description: "Akses baca penuh ke seluruh jejak audit dan riwayat model — tidak dapat mengubah data apa pun." },
];

/**
 * "Role separation" section — the five non-overlapping roles per
 * docs/product/RBAC_MATRIX.md, communicated to a public audience without
 * exposing internal implementation detail.
 */
export function RoleSeparationSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-sans text-2xl font-bold text-on-surface sm:text-3xl">
          Lima Peran, Tanpa Tumpang Tindih
        </h2>
        <p className="mt-2 font-sans text-sm text-on-surface-variant">
          Setiap peran memiliki wewenang yang jelas dan terpisah — tidak ada satu peran yang dapat
          diam-diam mengambil alih wewenang peran lain.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {ROLES.map((item) => (
          <div
            key={item.role}
            className="flex flex-col gap-3 rounded-lg border border-brand-border bg-surface-container-lowest p-5"
          >
            <RoleBadge role={item.role} />
            <p className="font-sans text-sm text-on-surface-variant">{item.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
