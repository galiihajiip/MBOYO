import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Only needed for .tsx test files' JSX transform under vitest's Vite
  // pipeline — this project otherwise builds/serves through Next.js's own
  // toolchain, not this Vite config, so this plugin has no effect outside
  // the test runner.
  plugins: [react()],
  test: {
    environment: "node",
    // Component tests (.test.tsx) opt into a jsdom environment per-file via
    // a `// @vitest-environment jsdom` docblock at the top of the file
    // (vitest's documented per-file override) — the global default stays
    // "node" so every existing lib/-layer .test.ts keeps its current,
    // faster environment unchanged.
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["src/lib/offline/test-setup.ts", "src/test-support/jest-dom-setup.ts"],
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
