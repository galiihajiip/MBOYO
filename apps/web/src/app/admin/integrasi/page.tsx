import type { Metadata } from "next";
import { StubPage } from "../../../components/shell/StubPage";

export const metadata: Metadata = { title: "Integrasi — MBOYO" };

export default function IntegrasiPage() {
  return (
    <StubPage
      title="Integrasi"
      description="Konfigurasi integrasi opsional (mis. Gemini sebagai saran tambahan, penyedia notifikasi) menyusul pada blok implementasi Administrasi."
    />
  );
}
