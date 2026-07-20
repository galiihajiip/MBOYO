import type { Metadata } from "next";
import { StubPage } from "../../../components/shell/StubPage";

export const metadata: Metadata = { title: "Tugas Respons — MBOYO" };

export default function TugasResponsPage() {
  return (
    <StubPage
      title="Tugas Respons"
      description="Pembuatan, penugasan, dan pelacakan status tugas respons menyusul pada blok implementasi Koordinator."
    />
  );
}
