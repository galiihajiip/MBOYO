# ADR 0005 — Offline Queue via IndexedDB (Dexie) and Workbox Background Sync

## Status

Accepted

## Context

The offline-first product pillar in [PRODUCT_CHARTER.md](../product/PRODUCT_CHARTER.md) and the offline-first invariants in [AGENTS.md](../../AGENTS.md) require that report creation never depend on live network availability, that queued reports survive a page reload, and that sync happen automatically on reconnect without user action. This needs a durable, structured client-side store plus a mechanism to defer and retry network requests across the boundary of a service worker, since a plain in-memory queue would be lost on reload and a naive `fetch`-and-retry in page JavaScript would not survive the user closing the tab before reconnecting.

## Decision

Use Dexie (a wrapper over IndexedDB) as the local report queue's storage engine, and a Workbox-based service worker using the Background Sync API to defer and retry the sync request until connectivity returns, even across page reloads or the tab being closed.

## Consequences

- Report creation writes only to IndexedDB via Dexie and returns immediately — this is the concrete mechanism that satisfies "report creation never depends on a live network call" in [AGENTS.md](../../AGENTS.md), and is exercised in [SEQUENCE_FLOWS.md](../architecture/SEQUENCE_FLOWS.md) Diagram 3 (Offline Replay).
- IndexedDB persists across page reload by design, satisfying the MVP acceptance requirement ("queue persists after reload") in [MVP_SCOPE.md](../product/MVP_SCOPE.md) without additional custom persistence logic.
- Background Sync means the actual sync attempt is owned by the service worker, not the page — so a Reporter who queues a report and closes the browser before reconnecting still gets an automatic sync attempt once the OS/browser fires the sync event, without needing the app open.
- Each locally created report carries a client-generated `dedupe_key` at creation time (not at sync time), which is what makes the server-side upsert in [SEQUENCE_FLOWS.md](../architecture/SEQUENCE_FLOWS.md) Diagram 3 idempotent against Background Sync's inherent retry behavior — this pairs directly with [ADR 0003](0003-database-job-queue.md)'s job-queue idempotency concern but addresses the client-to-server leg specifically.
- Background Sync API support varies by browser (notably weaker/absent on some non-Chromium browsers); where unsupported, the app must fall back to a foreground retry-on-reconnect strategy (e.g., `online` event listener attempting sync while the page is open) so the offline guarantee degrades gracefully rather than silently failing on unsupported browsers — this fallback path must be implemented and tested, not assumed away.
- IndexedDB storage is not guaranteed indefinite persistence (browser eviction under storage pressure) — this is the same limitation tracked as [RISK_REGISTER.md](../product/RISK_REGISTER.md) risk #2, mitigated by requesting persistent storage and surfacing queue/unsynced-item status to the Reporter, not fully eliminated by this architectural choice.
- Data sitting in IndexedDB before sync is subject to the offline-device-exposure threat in [THREAT_MODEL.md](../security/THREAT_MODEL.md) threat #10 — an accepted tradeoff of the offline-first pillar, not a gap introduced by this specific technology choice (any local-first storage mechanism would share this exposure).

## Alternatives Considered

- **In-memory queue with page-level retry only (no service worker):** rejected — does not survive page reload or tab closure, failing the MVP acceptance criterion that the queue persists after reload and syncs automatically on reconnect without requiring the user to keep the app open.
- **`localStorage` instead of IndexedDB:** rejected — `localStorage` is synchronous, has a much smaller storage quota, and cannot efficiently store binary evidence photos, making it unsuitable for report-plus-photo payloads.
- **Raw IndexedDB API without Dexie:** viable but rejected for developer-ergonomics reasons — Dexie's schema/versioning and query API meaningfully reduce the surface for subtle bugs in queue read/write logic compared to hand-rolled IndexedDB transaction code, without giving up any capability this project needs.
