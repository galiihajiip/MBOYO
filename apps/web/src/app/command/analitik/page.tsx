import type { Metadata } from "next";
import { StubPage } from "../../../components/shell/StubPage";

export const metadata: Metadata = { title: "Analitik — MBOYO" };

export default function AnalitikPage() {
  return (
    <StubPage
      title="Analitik"
      description="Dasbor jumlah insiden berdasarkan tingkat keparahan, status, dan wilayah menyusul pada blok implementasi Koordinator."
    />
  );
}
