import type { Metadata } from "next";
import { ReportWizard } from "./ReportWizard";

export const metadata: Metadata = { title: "Buat Laporan — MBOYO" };

export default function BuatLaporanPage() {
  return <ReportWizard />;
}
