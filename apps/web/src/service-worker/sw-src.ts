/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute, setCatchHandler } from "workbox-routing";
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { runQueueReplay } from "../lib/offline/sync-replay";

interface SyncEvent extends ExtendableEvent {
  readonly tag: string;
  readonly lastChance: boolean;
}

interface ServiceWorkerGlobalScopeWithManifest extends ServiceWorkerGlobalScope {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
}

type RouteMatchCallback = (options: { event: ExtendableEvent; request: Request; sameOrigin: boolean; url: URL }) => unknown;
type RouteHandler = (options: { event: ExtendableEvent; request: Request; url: URL }) => Promise<Response>;

declare const self: ServiceWorkerGlobalScopeWithManifest;

/**
 * MBOYO service worker — Workbox injectManifest source, built by
 * scripts/build-sw.ts into public/sw.js (the file actually registered by
 * the browser). See docs/architecture/PWA_OFFLINE.md for the full caching
 * matrix, privacy rules, and known browser limitations this file
 * implements.
 *
 * self.__WB_MANIFEST is replaced at build time by workbox-build's
 * injectManifest with the real precache manifest (every hashed static
 * asset + the app shell HTML) — this is the "app shell precache"
 * requirement.
 */
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

const OFFLINE_FALLBACK_URL = "/offline.html";

// ============================================================================
// CACHING STRATEGIES
// ============================================================================

/**
 * Navigation requests (HTML pages): network-first, falling back to the
 * cached app shell if the network is unreachable, and finally to a static
 * offline fallback page if nothing is cached for this URL either. This is
 * deliberately network-first (not cache-first) for navigations — a stale
 * cached page silently shown while online would contradict the
 * "auditable/never claim live data falsely" spirit of AGENTS.md, even
 * though this is a UX/caching concern rather than a data-integrity one.
 */
const isNavigationRequest: RouteMatchCallback = ({ request }) => request.mode === "navigate";

registerRoute(
  isNavigationRequest,
  new NetworkFirst({
    cacheName: "mboyo-pages",
    networkTimeoutSeconds: 4,
    plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 })],
  }),
);

/**
 * Cache-first for immutable, hashed static assets (Next.js's
 * /_next/static/** build output, and our own /icons/**) — these URLs
 * change only when their content changes (content-hashed filenames), so
 * serving a cached copy indefinitely is correct, not stale.
 */
const isImmutableAsset: RouteMatchCallback = ({ url }) =>
  url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");

registerRoute(
  isImmutableAsset,
  new CacheFirst({
    cacheName: "mboyo-immutable-assets",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 365 * 24 * 60 * 60 }),
    ],
  }),
);

/**
 * Stale-while-revalidate for SELECTED public, non-sensitive resources only
 * — explicitly the four trust pages and the manifest, per this block's
 * "selected public resources" requirement (not a blanket rule for
 * everything public, since even public pages can change content that
 * should be reasonably fresh). Serves the cached version immediately while
 * fetching an update in the background for next time.
 */
const isSelectedPublicResource: RouteMatchCallback = ({ url }) =>
  ["/privacy", "/methodology", "/data-governance", "/accessibility", "/manifest.webmanifest"].includes(
    url.pathname,
  );

registerRoute(isSelectedPublicResource, new StaleWhileRevalidate({ cacheName: "mboyo-public-swr" }));

/**
 * Explicit exclusion, not just an absence of a matching route: authenticated
 * API responses and signed evidence URLs must NEVER be cached by default,
 * per this block's requirement and docs/security/THREAT_MODEL.md threat #5
 * (signed URL leakage) — caching a signed URL response would let it be
 * replayed from the Cache Storage API well past its intended short
 * expiry, and caching an authenticated API response risks serving another
 * user's (or a stale/unauthorized) view of their own data after a
 * sign-out on a shared device. registerRoute's absence of a matching
 * handler for /api/* already means "network only, no caching" by Workbox
 * default, but this NetworkOnly-equivalent guard is written out
 * explicitly so the exclusion is visible in the source, not just implied
 * by omission — a future edit adding a broad catch-all route would have
 * to deliberately override this comment's intent, not silently regress it.
 */
const isApiOrSignedUrl: RouteMatchCallback = ({ url }) =>
  url.pathname.startsWith("/api/") || url.searchParams.has("token");

const networkOnlyHandler: RouteHandler = ({ request }) => fetch(request);

registerRoute(isApiOrSignedUrl, networkOnlyHandler);

/**
 * Catch-all fallback: if a navigation fails and nothing is cached for it
 * (first visit to a page while offline, or the network-first attempt
 * above exhausted its cached fallback), serve the static offline page —
 * "offline navigation works" per this block's acceptance criteria, rather
 * than the browser's own generic "no internet" error page.
 */
const offlineCatchHandler: RouteHandler = async ({ request }) => {
  if (request.mode === "navigate") {
    const cache = await caches.open("mboyo-pages");
    const cached = await cache.match(OFFLINE_FALLBACK_URL);
    if (cached) return cached;
  }
  return Response.error();
};

setCatchHandler(offlineCatchHandler);

// ============================================================================
// BACKGROUND SYNC
// ============================================================================

const SYNC_TAG = "mboyo-report-queue-replay";

/**
 * Native Background Sync: the browser fires this event once connectivity
 * is restored (even if the app itself isn't open), and Chromium retries
 * automatically if the returned promise rejects. This is the primary sync
 * trigger where supported.
 */
self.addEventListener("sync", (event) => {
  const syncEvent = event as SyncEvent;
  if (syncEvent.tag !== SYNC_TAG) return;
  syncEvent.waitUntil(replayAndNotify("background-sync"));
});

/**
 * Service-worker startup fallback: on every activation (including the SW
 * being woken back up after the browser evicted it from memory, or a
 * fresh install), attempt a replay pass. This covers browsers/situations
 * where a `sync` event was registered but never actually fired (e.g. iOS
 * Safari, which as of this writing does not support the Background Sync
 * API at all) — an SW activation is a reliable enough signal that "the
 * app is being used again" to justify a replay attempt without waiting
 * for a sync event that may simply never come.
 */
self.addEventListener("activate", (event) => {
  event.waitUntil(replayAndNotify("sw-startup"));
});

/**
 * Message channel to the app: lets a foreground page (see
 * components/pwa/SyncManager.tsx) explicitly request a replay pass — used
 * for the browser-online fallback (window "online" event) on browsers
 * without Background Sync support, and for a manual "coba lagi" (retry)
 * action triggered from the Antrean Offline screen while the SW, not the
 * page, owns the actual replay logic.
 */
self.addEventListener("message", (event) => {
  const data = event.data as { type?: string } | undefined;
  if (data?.type === "MBOYO_REQUEST_SYNC") {
    event.waitUntil(replayAndNotify("message-request"));
  }
  // Sent by components/pwa/UpdatePrompt.tsx only after the Reporter
  // explicitly taps "Perbarui Sekarang" — never automatic, so an update
  // never interrupts an in-progress report (see that component's own
  // comment for the full rationale on why this must stay user-initiated).
  if (data?.type === "MBOYO_SKIP_WAITING") {
    void self.skipWaiting();
  }
});

async function replayAndNotify(trigger: "background-sync" | "sw-startup" | "message-request"): Promise<void> {
  const summary = await runQueueReplay({
    onProgress: (progressEvent) => {
      void broadcastToClients({ type: "MBOYO_SYNC_PROGRESS", trigger, progress: progressEvent });
    },
  });
  await broadcastToClients({ type: "MBOYO_SYNC_COMPLETE", trigger, summary });
}

async function broadcastToClients(message: unknown): Promise<void> {
  const clients = await self.clients.matchAll({ type: "window" });
  for (const client of clients) {
    client.postMessage(message);
  }
}
