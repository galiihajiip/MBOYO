import type { Metadata } from "next";
import { PublicHeader } from "../components/marketing/PublicHeader";
import { PublicFooter } from "../components/marketing/PublicFooter";
import { Hero } from "../components/marketing/Hero";
import { TechPartnersBar } from "../components/marketing/sections/TechPartnersBar";
import { ProblemSection } from "../components/marketing/sections/ProblemSection";
import { SolutionSection } from "../components/marketing/sections/SolutionSection";
import { FlowSection } from "../components/marketing/sections/FlowSection";
import { RoleSeparationSection } from "../components/marketing/sections/RoleSeparationSection";
import { ArchitectureHub } from "../components/marketing/sections/ArchitectureHub";
import { ImpactContextSection } from "../components/marketing/sections/ImpactContextSection";
import { TechAndMetricsHub } from "../components/marketing/sections/TechAndMetricsHub";
import { DemoAccountsSection } from "../components/marketing/sections/DemoAccountsSection";
import { FaqSection } from "../components/marketing/sections/FaqSection";
import { CtaBanner } from "../components/marketing/sections/CtaBanner";

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
      <main className="overflow-x-hidden bg-surface">
        <Hero />
        <TechPartnersBar />
        <ProblemSection />
        <SolutionSection />
        <FlowSection />
        <RoleSeparationSection />
        <ArchitectureHub />
        <ImpactContextSection />
        <TechAndMetricsHub />
        <DemoAccountsSection />
        <FaqSection />
        <CtaBanner />
      </main>
      <PublicFooter />
    </>
  );
}
