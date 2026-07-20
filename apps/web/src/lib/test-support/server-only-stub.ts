// Test-only stand-in for the "server-only" package — see vitest.config.ts's
// alias. Intentionally empty: the real package's only behavior is throwing
// when imported outside a Server Component module graph, which is exactly
// what this stub must NOT do so server-only-marked pure logic (lib/evidence/*)
// can be unit-tested under plain Node/vitest.
export {};
