import type { Metadata } from "next";
import { StubPage } from "../../../components/shell/StubPage";

export const metadata: Metadata = { title: "Notifikasi — MBOYO" };

export default function VerifierNotifikasiPage() {
  return (
    <StubPage
      title="Notifikasi"
      description="Notifikasi antrean baru dan tanggapan pelapor menyusul pada blok implementasi Notifikasi."
    />
  );
}
