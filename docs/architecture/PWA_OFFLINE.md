# PWA & Offline Architecture

This document describes the installable-PWA and offline-caching layer built in BLOCK 14, on top of the IndexedDB/Dexie offline queue from BLOCK 13 (see [ADR 0005](../adr/0005-offline-indexeddb-workbox.md)). It covers what is cached, why, what is deliberately never cached, and known browser limitations Reporters and reviewers should be aware of.

## Source of truth

- Service worker source: [`apps/web/src/service-worker/sw-src.ts`](../../apps/web/src/service-worker/sw-src.ts) — a Workbox `injectManifest` source, not `GenerateSW`, since this is a Turbopack/Next.js project.
- Build script: [`apps/web/scripts/build-sw.ts`](../../apps/web/scripts/build-sw.ts) — esbuild-bundles the TS source into a classic IIFE script, then `workbox-build`'s `injectManifest()` replaces `self.__WB_MANIFEST` with the real precache list and writes `apps/web/public/sw.js`. Runs via `pnpm build:sw`, wired **after** `next build` in `apps/web/package.json`'s `build` script, since it needs `.next/static/**` to exist to glob and hash.
- `public/sw.js` is a build artifact, not source (gitignored alongside `apps/web/.sw-build/`); `sw-src.ts` is the tracked source of truth.
- The SW registers only when `NEXT_PUBLIC_APP_ENV === "production"` (see [`ServiceWorkerRegistration.tsx`](../../apps/web/src/components/pwa/ServiceWorkerRegistration.tsx)) — dev mode never registers it, to avoid fighting Next.js's own HMR/fast refresh.

## Caching matrix

| Content | Strategy | Cache name | Rationale |
|---|---|---|---|
| Next.js immutable build output (`/_next/static/**`), app icons (`/icons/**`) | Cache-first | `mboyo-immutable-assets` | Content-hashed filenames — a cached copy is never stale by definition. |
| Navigations (HTML pages, any route) | Network-first, 4s timeout, falls back to cache | `mboyo-pages` | Never silently serve stale HTML while online; only fall back to cache once the network is judged unreachable. |
| Four public trust pages (`/privacy`, `/methodology`, `/data-governance`, `/accessibility`) + `/manifest.webmanifest` | Stale-while-revalidate | `mboyo-public-swr` | Explicitly selected, non-sensitive, low-churn public content — instant load from cache, refreshed in the background for next visit. Not a blanket rule for all public pages. |
| App shell: `offline.html`, `manifest.webmanifest`, icons, favicon, all `.next/static/**` assets | Precached at build time (`self.__WB_MANIFEST`) | Workbox precache cache | Guarantees these are available offline from the very first load, before any runtime cache entry exists. |
| Any `/api/*` request, or any request with a `?token=` query param (signed evidence URLs) | Network-only, explicit guard, never cached | — | See Privacy rules below. |
| First-time navigation failure with nothing cached | Static offline fallback (`/offline.html`) served from `mboyo-pages` | — | `setCatchHandler` — avoids the browser's generic "no internet" error page. |

## Privacy rules

- **Authenticated API responses (`/api/*`) are never cached**, by an explicit `registerRoute` guard that always passes through to `fetch`, not merely by omission of a route (a future edit adding a broad catch-all could otherwise silently regress this — the explicit guard makes the exclusion visible in source). Caching an API response risks serving another user's (or a stale/unauthorized) view of data after a sign-out on a shared device.
- **Signed evidence URLs (any request with a `?token=` query param) are never cached**, for the same reason plus [THREAT_MODEL.md](../security/THREAT_MODEL.md) threat #5 (signed URL leakage) — a cached signed URL response could be replayed from the Cache Storage API well past its intended short expiry.
- The only "last-known" data available offline is what already lives in the Reporter's own local IndexedDB queue (their own draft/queued/synced reports) — this is existing local-first data from BLOCK 13, not new server data pulled into a cache. No other user's data, and no server-fetched report status, is cached for offline display.

## Last-known own-report summaries

`/reporter/laporan` ([`ReportListClient.tsx`](../../apps/web/src/app/reporter/laporan/ReportListClient.tsx)) and `/reporter/laporan/[id]` read exclusively from the Reporter's local Dexie queue via `OfflineReportRepository.listOwnReports()` / `getOwnReport()` — this was already fully local-first as of BLOCK 13's `DexieReportRepository`. There is no separate "cache" to add: once the page shell (HTML/JS) is cached by the network-first navigation strategy on a prior visit, the page continues to render the Reporter's own last-known report summaries (draft, queued, syncing, synced, failed) entirely from IndexedDB with zero network dependency. This satisfies "last-known own-report summaries where safe" without introducing a second, redundant data source that could drift from the queue's actual state.

## Offline reporter pages

Reporter-role pages fall into two categories:

- **Fully offline-capable after first visit**: `/reporter/laporan` (own reports list), `/reporter/laporan/[id]` (own report detail), `/reporter/antrean` (offline queue status), `/reporter/laporan/baru` (report wizard), `/reporter/bantuan` (static FAQ). These are client components or static content with no server-side auth-dependent data fetch, so once their page shell is cached (first visit while online), they render fully offline on repeat visits.
- **Require a live or previously-cached session-rendered HTML response**: `/reporter` (home) and `/reporter/profil` call `getCurrentUser()` server-side and render the display name/email into the HTML. These are `force-dynamic` routes (per the BLOCK 09/11 pattern, to avoid build-time env errors) and therefore **cannot** be part of the injectManifest precache list, which only works for static files. Offline access to these two pages relies entirely on the network-first runtime cache having captured a previous successful render — not precaching. This is a real, documented limitation, not a gap to silently paper over.

## Sync architecture

All queue-replay logic lives in one place — [`lib/offline/sync-replay.ts`](../../apps/web/src/lib/offline/sync-replay.ts)'s `runQueueReplay()` — called by every trigger below. No trigger re-implements claim/POST/mark-synced logic; each just invokes `runQueueReplay()`.

| Trigger | Mechanism | When it fires |
|---|---|---|
| Native Background Sync | `self.addEventListener("sync", ...)` in `sw-src.ts`, tag `mboyo-report-queue-replay` | Browser-scheduled, even if the app isn't open (Chromium only). |
| Browser online fallback | [`OnlineSyncFallback.tsx`](../../apps/web/src/components/pwa/OnlineSyncFallback.tsx) listens for `window`'s `"online"` event, posts `MBOYO_REQUEST_SYNC` to the active SW | Browsers without Background Sync support (notably Safari), or as a harmless redundant trigger everywhere else — `withSyncLock` prevents double-processing. |
| SW startup fallback | `self.addEventListener("activate", ...)` in `sw-src.ts` | Every SW activation (fresh install, or the SW being woken back up after eviction) — covers the case where a `sync` event was registered but the browser never fires it. |
| Message-request | `self.addEventListener("message", ...)` handling `MBOYO_REQUEST_SYNC` | Used by the online fallback above, and by `dexie-report-repository.ts`'s `submitDraft()` immediately after enqueueing (via [`trigger-sync.ts`](../../apps/web/src/lib/offline/trigger-sync.ts), which itself prefers native `registration.sync.register()` and falls back to this message if unsupported/failed). |

Sync progress and completion are broadcast from the SW to all window clients via `postMessage` (`MBOYO_SYNC_PROGRESS`, `MBOYO_SYNC_COMPLETE`); [`useSyncProgress.ts`](../../apps/web/src/components/pwa/useSyncProgress.ts) surfaces completion as a toast.

Single-flight locking (`navigator.locks`, from BLOCK 13's [`single-flight-lock.ts`](../../apps/web/src/lib/offline/single-flight-lock.ts)) ensures concurrent trigger firings (e.g. `activate` and a near-simultaneous `online` event) never process the same queue items twice.

## Install & update UX

- **Install prompt**: [`InstallPrompt.tsx`](../../apps/web/src/components/pwa/InstallPrompt.tsx) captures `beforeinstallprompt`, shows a custom banner, calls `.prompt()` on user tap. Detects already-installed/standalone state via `display-mode: standalone` media query (and iOS's `navigator.standalone`) and never renders if already installed. Dismissal is remembered in `localStorage`.
- **Update-available prompt**: [`UpdatePrompt.tsx`](../../apps/web/src/components/pwa/UpdatePrompt.tsx) watches `registration.waiting` / `updatefound`. `skipWaiting()` is triggered **only** by an explicit `MBOYO_SKIP_WAITING` message sent after the Reporter taps "Perbarui Sekarang" — never automatically, so an update can never interrupt an in-progress report wizard session. A `controllerchange` listener reloads the page exactly once after the new SW takes control.
- **Standalone mode**: existing `display: "standalone"` manifest setting (BLOCK 06, `apps/web/public/manifest.webmanifest`) is unchanged by this block.

## Known browser limitations

- **Background Sync API is Chromium-only.** Safari (desktop and iOS) and Firefox do not support `SyncManager` as of this writing. On those browsers, sync relies entirely on the `online`-event fallback (app must be open, or reopened, for a sync attempt) and the SW-startup fallback (fires on activation, which still requires the browser to have woken the SW at all).
- **iOS Safari service worker lifecycle** is more aggressive about evicting/suspending service workers than desktop browsers, and installed-PWA behavior (via "Add to Home Screen") has its own quirks (e.g. no `beforeinstallprompt` event at all — iOS requires the manual Share-sheet install flow, which `InstallPrompt.tsx` does not attempt to replicate; iOS users simply won't see the custom install banner).
- **IndexedDB storage is not guaranteed indefinite** under browser storage pressure (tracked pre-existing risk, see ADR 0005) — this block requests persistent storage but cannot force it.
- **Precaching cannot cover authenticated/dynamic pages** (`/reporter`, `/reporter/profil`, and equivalent pages for other roles) — see "Offline reporter pages" above.

## Acceptance verification

- **Installability**: manifest (`display: "standalone"`, icons, name) from BLOCK 06 is unchanged; SW registers at `/sw.js` scope `/` in production builds. Not verified via live Lighthouse/browser automation in this session (no browser automation tool available) — verified structurally (valid manifest fields, SW registers and precaches successfully per `build-sw.ts` output).
- **Offline navigation**: `setCatchHandler` serves the precached `/offline.html` when a navigation fails with nothing else cached; verified via `build-sw.ts`'s precache manifest containing `/offline.html` (confirmed present after the `public/` glob-path fix — see Limitations).
- **Queue replay with and without native Background Sync**: `runQueueReplay()` is a single, trigger-agnostic function; the `online`-event and message-request fallbacks call the identical code path as the native `sync` event, so behavioral parity is by construction, not duplicated logic. Not yet covered by an automated vitest test in this block (existing BLOCK 13 suite covers the queue itself, not the SW-side replay orchestration) — tracked as a limitation below.

## Limitations

- No automated test coverage yet for `runQueueReplay()`'s trigger-agnostic behavior itself (the underlying queue claim/mark logic it calls is tested from BLOCK 13); a vitest test with mocked `fetch` and `fake-indexeddb` is the natural next addition.
- Installability and offline-navigation acceptance criteria were verified structurally (manifest fields, precache manifest contents, SW registration logic) rather than via live browser/Lighthouse automation, since no browser automation tool is available in this session.
- `/reporter` and `/reporter/profil` are not offline-capable on first-ever visit while offline (see "Offline reporter pages").
- Evidence upload endpoint (`/api/reports/evidence`) is intentionally minimal for this block — no thumbnailing, no perceptual hash — sufficient for real end-to-end sync, not a complete evidence pipeline.
