import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/lib/offline/test-setup.ts"],
    alias: {
      // The real server-only package throws unconditionally outside a
      // Next.js Server Component module graph — needed there to make an
      // accidental client-bundle import fail loudly, but that same guard
      // makes it impossible to unit-test any server-only-marked pure logic
      // (e.g. lib/evidence/*.ts) under plain vitest/Node. Substitute a
      // no-op for tests only; production code still imports the real
      // package via Next.js's own build, which this alias never touches.
      "server-only": fileURLToPath(new URL("./src/lib/test-support/server-only-stub.ts", import.meta.url)),
    },
  },
});
