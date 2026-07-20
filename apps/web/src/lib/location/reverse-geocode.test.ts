import { afterEach, describe, expect, it, vi } from "vitest";

describe("getReverseGeocoder — null fallback when unconfigured", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("resolve() always returns null when MAPTILER_API_KEY is not set — no fabricated address", async () => {
    vi.doMock("../env.server", () => ({
      getServerEnv: () => ({ MAPTILER_API_KEY: undefined }),
    }));

    const { getReverseGeocoder } = await import("./reverse-geocode");
    const geocoder = getReverseGeocoder();

    const result = await geocoder.resolve(106.827, -6.175);
    expect(result).toBeNull();
  });
});
