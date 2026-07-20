import type { Metadata } from "next";
import { StubPage } from "../../../components/shell/StubPage";

export const metadata: Metadata = { title: "Laporan Read-Only — MBOYO" };

/** Per RBAC_MATRIX.md / "Auditor cannot mutate": zero action affordances anywhere on this screen. */
export default function LaporanReadOnlyPage() {
  return (
    <StubPage
      title="Laporan Read-Only"
      description="Peninjauan lengkap laporan (bukti, prediksi, keputusan verifikasi) tanpa satu pun kontrol aksi — Mode Audit — Hanya Baca — menyusul pada blok implementasi Auditor."
    />
  );
}
