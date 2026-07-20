// Vitest setup file: polyfills `indexedDB`/`IDBKeyRange` globally via
// fake-indexeddb, so Dexie (lib/offline/db.ts) works under Node/vitest
// exactly as it would in a real browser, without a headless browser.
import "fake-indexeddb/auto";
