import type { Metadata } from "next";
import { ReportDetailClient } from "./ReportDetailClient";

export const metadata: Metadata = { title: "Detail Laporan — MBOYO" };

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReportDetailClient clientReportId={id} />;
}
