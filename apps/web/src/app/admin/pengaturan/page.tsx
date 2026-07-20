import type { Metadata } from "next";
import { StubPage } from "../../../components/shell/StubPage";

export const metadata: Metadata = { title: "Pengaturan — MBOYO" };

export default function PengaturanPage() {
  return (
    <StubPage
      title="Pengaturan"
      description="Konfigurasi umum termasuk kebijakan retensi data menyusul pada blok implementasi Administrasi."
    />
  );
}
