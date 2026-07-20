import type { Metadata } from "next";
import { StubPage } from "../../../components/shell/StubPage";

export const metadata: Metadata = { title: "Aturan Eskalasi — MBOYO" };

export default function AturanEskalasiPage() {
  return (
    <StubPage
      title="Aturan Eskalasi"
      description="Konfigurasi ambang kualitas/kepercayaan yang memicu tinjauan manual menyusul pada blok implementasi Administrasi."
    />
  );
}
