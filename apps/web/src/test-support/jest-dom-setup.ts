// Extends vitest's `expect` with jest-dom's DOM-specific matchers
// (toBeInTheDocument, toBeDisabled, etc.) for component tests. Safe to load
// for every test file (including node-environment lib/ tests) — jest-dom's
// matcher extension itself has no environment dependency; only the
// matchers a test actually calls require a DOM to exist.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// @testing-library/react's own auto-cleanup registration only activates
// when it detects vitest's `afterEach` as a *global* (test.globals: true) —
// this project deliberately does not enable that (every existing lib/
// test file explicitly imports describe/it/expect from "vitest" rather
// than relying on globals), so cleanup is registered explicitly here
// instead. Without this, each component test's rendered tree would persist
// in jsdom's shared document across tests in the same file.
afterEach(() => {
  cleanup();
});
