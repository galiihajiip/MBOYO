import type { Metadata } from "next";
import { StubPage } from "../../../components/shell/StubPage";

export const metadata: Metadata = { title: "Event Bencana — MBOYO" };

export default function EventBencanaPage() {
  return (
    <StubPage
      title="Event Bencana"
      description="Pembuatan dan pengelolaan event bencana, termasuk konfigurasi geofence, menyusul pada blok implementasi Administrasi."
    />
  );
}
