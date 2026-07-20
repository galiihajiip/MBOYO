import type { MetadataRoute } from "next";

/**
 * Disallows every authenticated/internal route from crawling —
 * role-specific dashboards contain no content meant for public indexing,
 * and /masuk (login) and /design-system (internal reference) likewise
 * gain nothing from being indexed.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/reporter",
        "/verifier",
        "/command",
        "/admin",
        "/audit",
        "/masuk",
        "/sesi-berakhir",
        "/tidak-diizinkan",
        "/design-system",
        "/api/",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
