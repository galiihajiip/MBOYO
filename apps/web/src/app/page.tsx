import type { Metadata } from "next";
import { PublicHeader } from "../components/marketing/PublicHeader";
import { PublicFooter } from "../components/marketing/PublicFooter";
import { Hero } from "../components/marketing/Hero";
import { ProblemSection } from "../components/marketing/sections/ProblemSection";
import { SolutionSection } from "../components/marketing/sections/SolutionSection";
import { FlowSection } from "../components/marketing/sections/FlowSection";
import { RoleSeparationSection } from "../components/marketing/sections/RoleSeparationSection";
import { OfflineProofSection } from "../components/marketing/sections/OfflineProofSection";
import { AiHumanSection } from "../components/marketing/sections/AiHumanSection";
import { GeospatialSection } from "../components/marketing/sections/GeospatialSection";
import { TechnologySection } from "../components/marketing/sections/TechnologySection";
import { DataSovereigntySection } from "../components/marketing/sections/DataSovereigntySection";
import { MetricsSection } from "../components/marketing/sections/MetricsSection";
import { DemoAccountsSection } from "../components/marketing/sections/DemoAccountsSection";
import { FaqSection } from "../components/marketing/sections/FaqSection";

export const metadata: Metadata = {
  title: "MBOYO — Laporan Tetap Jalan. Respons Lebih Tepat.",
  description:
    "Platform pelaporan bencana offline-first dengan triase computer vision lokal, verifikasi manusia, dan koordinasi respons geospasial.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <>
      <PublicHeader />
      <main>
        <Hero />
        <ProblemSection />
        <SolutionSection />
        <FlowSection />
        <RoleSeparationSection />
        <OfflineProofSection />
        <AiHumanSection />
        <GeospatialSection />
        <TechnologySection />
        <DataSovereigntySection />
        <MetricsSection />
        <DemoAccountsSection />
        <FaqSection />
      </main>
      <PublicFooter />
    </>
  );
}
