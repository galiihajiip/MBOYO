import type { Metadata } from "next";
import { StubPage } from "../../../components/shell/StubPage";

export const metadata: Metadata = { title: "Notifikasi — MBOYO" };

export default function CommandNotifikasiPage() {
  return (
    <StubPage
      title="Notifikasi"
      description="Notifikasi insiden terverifikasi baru dan pembaruan tugas menyusul pada blok implementasi Notifikasi."
    />
  );
}
