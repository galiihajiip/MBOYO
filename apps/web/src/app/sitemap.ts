import type { MetadataRoute } from "next";

/**
 * Sitemap covering only genuinely public, indexable routes — authenticated
 * role routes (/reporter, /verifier, /command, /admin, /audit) and the
 * design-system reference are deliberately excluded, matching robots.ts's
 * disallow list.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const lastModified = new Date("2026-07-16");

  const routes = ["/", "/privacy", "/methodology", "/data-governance", "/accessibility"];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified,
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : 0.5,
  }));
}
