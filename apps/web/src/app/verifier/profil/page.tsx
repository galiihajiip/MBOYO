import type { Metadata } from "next";
import { StubPage } from "../../../components/shell/StubPage";

export const metadata: Metadata = { title: "Profil — MBOYO" };

export default function VerifierProfilPage() {
  return (
    <StubPage
      title="Profil"
      description="Pengelolaan data akun menyusul pada blok implementasi Profil."
    />
  );
}
