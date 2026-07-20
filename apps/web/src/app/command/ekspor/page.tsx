import type { Metadata } from "next";
import { StubPage } from "../../../components/shell/StubPage";

export const metadata: Metadata = { title: "Ekspor — MBOYO" };

export default function EksporPage() {
  return (
    <StubPage
      title="Ekspor"
      description="Pembuatan dan pengunduhan ekspor data operasional (CSV/GeoJSON) menyusul pada blok implementasi Koordinator."
    />
  );
}
