import type { Metadata } from "next";
import { StubPage } from "../../../components/shell/StubPage";

export const metadata: Metadata = { title: "Pengguna & Role — MBOYO" };

export default function PenggunaRolePage() {
  return (
    <StubPage
      title="Pengguna & Role"
      description="Pengelolaan pengguna dan penetapan role — satu-satunya tempat role_assignment diubah — menyusul pada blok implementasi Administrasi."
    />
  );
}
