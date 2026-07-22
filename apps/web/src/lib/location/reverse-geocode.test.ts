import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeDb } from "../reports/service/test-support/fake-db";

describe("getReverseGeocoder — null fallback when unconfigured", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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

describe("getReverseGeocoder — MapTiler-backed adapter when MAPTILER_API_KEY is configured", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function mockEnvAndDb(db: ReturnType<typeof createFakeDb>) {
    vi.doMock("../env.server", () => ({
      getServerEnv: () => ({ MAPTILER_API_KEY: "test-key" }),
    }));
    vi.doMock("../supabase/service-role.server", () => ({
      getServiceRoleClient: () => db,
    }));
  }

  it("returns the cached address without calling fetch on a cache hit", async () => {
    const db = createFakeDb({
      from: {
        reverse_geocode_cache: () => ({ data: { resolved_address: "Jl. Merdeka, Jakarta" }, error: null }),
      },
    });
    mockEnvAndDb(db);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { getReverseGeocoder } = await import("./reverse-geocode");
    const result = await getReverseGeocoder().resolve(106.827, -6.175);

    expect(result).toEqual({ address: "Jl. Merdeka, Jakarta", provider: "maptiler" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns null on a cache hit whose cached resolved_address is null (a previously-failed lookup)", async () => {
    const db = createFakeDb({
      from: { reverse_geocode_cache: () => ({ data: { resolved_address: null }, error: null }) },
    });
    mockEnvAndDb(db);
    vi.stubGlobal("fetch", vi.fn());

    const { getReverseGeocoder } = await import("./reverse-geocode");
    const result = await getReverseGeocoder().resolve(106.827, -6.175);

    expect(result).toBeNull();
  });

  it("calls the MapTiler API and caches the result on a cache miss", async () => {
    const db = createFakeDb({
      from: { reverse_geocode_cache: () => ({ data: null, error: null }) },
    });
    mockEnvAndDb(db);
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ features: [{ place_name: "Jl. Sudirman, Jakarta" }] }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const { getReverseGeocoder } = await import("./reverse-geocode");
    const result = await getReverseGeocoder().resolve(106.827, -6.175);

    expect(result).toEqual({ address: "Jl. Sudirman, Jakarta", provider: "maptiler" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toContain("106.827,-6.175");
  });

  it("resolves to null (never throws) when the provider call rejects", async () => {
    const db = createFakeDb({
      from: { reverse_geocode_cache: () => ({ data: null, error: null }) },
    });
    mockEnvAndDb(db);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const { getReverseGeocoder } = await import("./reverse-geocode");
    const result = await getReverseGeocoder().resolve(106.827, -6.175);

    expect(result).toBeNull();
  });

  it("resolves to null when the provider responds with a non-ok status", async () => {
    const db = createFakeDb({
      from: { reverse_geocode_cache: () => ({ data: null, error: null }) },
    });
    mockEnvAndDb(db);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    const { getReverseGeocoder } = await import("./reverse-geocode");
    const result = await getReverseGeocoder().resolve(106.827, -6.175);

    expect(result).toBeNull();
  });

  it("returns null when the provider response has no features", async () => {
    const db = createFakeDb({
      from: { reverse_geocode_cache: () => ({ data: null, error: null }) },
    });
    mockEnvAndDb(db);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ features: [] }) }));

    const { getReverseGeocoder } = await import("./reverse-geocode");
    const result = await getReverseGeocoder().resolve(106.827, -6.175);

    expect(result).toBeNull();
  });

  it("returns the same cached adapter instance on repeated calls (module-level singleton)", async () => {
    const db = createFakeDb({
      from: { reverse_geocode_cache: () => ({ data: { resolved_address: "Jl. Thamrin" }, error: null }) },
    });
    mockEnvAndDb(db);
    vi.stubGlobal("fetch", vi.fn());

    const { getReverseGeocoder } = await import("./reverse-geocode");
    const first = getReverseGeocoder();
    const second = getReverseGeocoder();

    expect(first).toBe(second);
  });
});
