import type { Metadata } from "next";
import { StubPage } from "../../../components/shell/StubPage";

export const metadata: Metadata = { title: "Prioritas — MBOYO" };

export default function PrioritasPage() {
  return (
    <StubPage
      title="Prioritas"
      description="Alur kerja penentuan prioritas insiden dan klaster menyusul pada blok implementasi Koordinator."
    />
  );
}
