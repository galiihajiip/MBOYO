/**
 * Builds public/sw.js from src/service-worker/sw-src.ts.
 *
 * Two steps:
 *  1. esbuild bundles the TypeScript source (including its lib/offline/*
 *     and Dexie imports) into a single classic-script-compatible bundle —
 *     service workers do not support ES module imports in all target
 *     browsers the same way a page does, so IIFE output is the safe
 *     choice, not `type: "module"` registration.
 *  2. workbox-build's injectManifest replaces the `self.__WB_MANIFEST`
 *     placeholder in that bundle with the real precache list, computed by
 *     hashing every file under .next/static (Next.js's immutable,
 *     content-hashed build output) plus the top-level static assets this
 *     project wants precached (icons, manifest, offline fallback page).
 *
 * Run via `pnpm build:sw`, wired AFTER `next build` in package.json's
 * `build` script — this must run after Next.js has produced
 * .next/static/** so there is a real, content-hashed asset list to glob
 * and precache. Dev mode does not run this at all: dev builds are not
 * content-hashed the same way, and registering a caching service worker
 * during development would fight with Next.js's own HMR/fast refresh —
 * see components/pwa/ServiceWorkerRegistration.tsx, which only registers
 * the SW when NEXT_PUBLIC_APP_ENV is not "development."
 */
import { build as esbuildBuild } from "esbuild";
import { injectManifest } from "workbox-build";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, "..");
const swSrc = join(appRoot, "src", "service-worker", "sw-src.ts");
const swBundleOut = join(appRoot, ".sw-build", "sw-bundle.js");
const swPublicOut = join(appRoot, "public", "sw.js");

async function run(): Promise<void> {
  mkdirSync(dirname(swBundleOut), { recursive: true });

  await esbuildBuild({
    entryPoints: [swSrc],
    outfile: swBundleOut,
    bundle: true,
    format: "iife",
    target: "es2020",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"' },
  });

  const { count, size, warnings } = await injectManifest({
    swSrc: swBundleOut,
    swDest: swPublicOut,
    globDirectory: appRoot,
    globPatterns: [
      // Next.js's own immutable, content-hashed build output.
      ".next/static/**/*.{js,css,woff2}",
      // Top-level static assets this app ships (icons, manifest, offline
      // fallback) — these are NOT content-hashed, so they're also handled
      // by the runtime CacheFirst route in sw-src.ts for updates; being in
      // the precache manifest just guarantees they're available offline
      // from the very first load.
      "public/icons/*.{svg,png}",
      "public/manifest.webmanifest",
      "public/offline.html",
      "public/favicon.ico",
    ],
    // .next/static assets are served from /_next/static/, not /static/;
    // public/** assets are served from /, without the "public/" prefix —
    // modifyURLPrefix rewrites the glob-discovered relative paths to the
    // actual URL path the browser will request.
    modifyURLPrefix: {
      ".next/static/": "/_next/static/",
      "public/": "/",
    },
    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  });

  if (warnings.length > 0) {
    console.warn("[build-sw] workbox-build warnings:", warnings);
  }

  console.log(`[build-sw] Precached ${count} files, totaling ${(size / 1024).toFixed(1)} KiB — wrote ${swPublicOut}`);
}

run().catch((error: unknown) => {
  console.error("[build-sw] failed:", error);
  process.exit(1);
});
