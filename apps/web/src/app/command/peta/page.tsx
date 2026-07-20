import type { Metadata } from "next";
import { StubPage } from "../../../components/shell/StubPage";

export const metadata: Metadata = { title: "Peta Krisis — MBOYO" };

export default function PetaKrisisPage() {
  return (
    <StubPage
      title="Peta Krisis"
      description="Peta insiden terverifikasi dengan tampilan daftar cadangan menyusul pada blok implementasi Koordinator."
    />
  );
}
