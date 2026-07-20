import type { Metadata } from "next";
import { StubPage } from "../../../components/shell/StubPage";

export const metadata: Metadata = { title: "Retensi Data — MBOYO" };

export default function RetensiDataPage() {
  return (
    <StubPage
      title="Retensi Data"
      description="Visibilitas kebijakan retensi dan status siklus hidup bukti (hanya baca) menyusul pada blok implementasi Auditor."
    />
  );
}
