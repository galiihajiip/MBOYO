import type { Metadata } from "next";
import { StubPage } from "../../../components/shell/StubPage";

export const metadata: Metadata = { title: "Evaluasi Model — MBOYO" };

export default function EvaluasiModelPage() {
  return (
    <StubPage
      title="Evaluasi Model"
      description="Laporan evaluasi model (macro-F1, recall hancur total, galat kalibrasi) yang mendasari setiap versi model menyusul pada blok implementasi Auditor."
    />
  );
}
