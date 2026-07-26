import type { Metadata } from "next";
import { getCurrentUser } from "../../lib/auth/server";
import { ReporterDashboardClient } from "./ReporterDashboardClient";

export const metadata: Metadata = {
  title: "Beranda — MBOYO",
};

export default async function ReporterHomePage() {
  const user = await getCurrentUser();

  return <ReporterDashboardClient displayName={user?.displayName ?? "Pelapor"} />;
}
