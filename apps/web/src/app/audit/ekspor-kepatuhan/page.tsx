import type { Metadata } from "next";
import { StubPage } from "../../../components/shell/StubPage";

export const metadata: Metadata = { title: "Export Compliance — MBOYO" };

export default function EksporKepatuhanPage() {
  return (
    <StubPage
      title="Export Compliance"
      description="Pembuatan ekspor kepatuhan dan riwayat seluruh ekspor organisasi (hanya baca kecuali aksi ekspor itu sendiri) menyusul pada blok implementasi Auditor."
    />
  );
}
