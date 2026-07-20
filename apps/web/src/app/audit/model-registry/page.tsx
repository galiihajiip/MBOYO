import type { Metadata } from "next";
import { StubPage } from "../../../components/shell/StubPage";

export const metadata: Metadata = { title: "Model Registry — MBOYO" };

export default function ModelRegistryPage() {
  return (
    <StubPage
      title="Model Registry"
      description="Riwayat versi model dan riwayat promosi (hanya baca) menyusul pada blok implementasi Auditor."
    />
  );
}
