import type { Metadata } from "next";
import { DesignSystemShowcase } from "./DesignSystemShowcase";

export const metadata: Metadata = {
  title: "Design System — MBOYO",
  description: "Referensi visual komponen dan token desain MBOYO.",
};

export default function DesignSystemPage() {
  return <DesignSystemShowcase />;
}
