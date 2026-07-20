import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, IBM_Plex_Mono } from "next/font/google";
import { ToastProvider } from "@mboyo/ui";
import { ServiceWorkerRegistration } from "../components/pwa/ServiceWorkerRegistration";
import { OnlineSyncFallback } from "../components/pwa/OnlineSyncFallback";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "MBOYO",
  description:
    "Laporan Tetap Jalan. Respons Lebih Tepat. Platform pelaporan bencana offline-first, verifikasi berbasis manusia, dan koordinasi respons.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "MBOYO",
    description: "Laporan Tetap Jalan. Respons Lebih Tepat.",
    images: [{ url: "/icons/og-image.png", width: 1200, height: 630 }],
    locale: "id_ID",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#082032",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${plusJakartaSans.variable} ${ibmPlexMono.variable}`}>
      <body className="bg-surface font-sans text-on-surface antialiased">
        <ToastProvider>
          {children}
          <ServiceWorkerRegistration />
          <OnlineSyncFallback />
        </ToastProvider>
      </body>
    </html>
  );
}
