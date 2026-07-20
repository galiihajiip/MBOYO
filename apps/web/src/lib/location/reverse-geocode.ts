import "server-only";
import { getServiceRoleClient } from "../supabase/service-role.server";
import { getServerEnv } from "../env.server";

/**
 * Optional reverse-geocoder adapter (this block's explicit "optional
 * reverse-geocoder adapter/cache" requirement) — resolves a coordinate to
 * a human-readable address for display alongside a manual map pin, purely
 * as a convenience label. NEVER used as an authoritative location source:
 * the recorded geolocation_observation's coordinates are always what was
 * actually captured/placed; a resolved address is supplementary display
 * text only, and a failed/unavailable lookup must never block report
 * submission (mirrors this block's "event-boundary warning... without
 * blocking emergency reports" principle applied to this adapter too).
 *
 * Cache-first, coordinate rounded to 4 decimal degrees (~11m) —
 * public.reverse_geocode_cache (this block's migration), read/written only
 * through the service-role client since no human role has a legitimate
 * reason to read this infrastructure table directly (RLS on it grants no
 * policies at all).
 */

export interface ReverseGeocodeResult {
  address: string;
  provider: string;
}

export interface ReverseGeocoder {
  resolve(longitude: number, latitude: number): Promise<ReverseGeocodeResult | null>;
}

function roundCoordinate(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * Demo-fallback adapter: always returns null (no fabricated address),
 * explicitly labeled per AGENTS.md's demo-fallback-disclosure rule — used
 * whenever no real geocoding provider is configured (MAPTILER_API_KEY
 * unset). A caller must treat null as "no address available," not an
 * error, and must never synthesize a placeholder address to fill the gap.
 */
class NullReverseGeocoder implements ReverseGeocoder {
  resolve(): Promise<ReverseGeocodeResult | null> {
    return Promise.resolve(null);
  }
}

/**
 * MapTiler-backed adapter, used only when MAPTILER_API_KEY is configured.
 * Reads/writes the cache table first so repeated lookups near the same
 * coordinate (e.g. a Verifier revisiting a report) don't re-call the
 * external provider. A provider-call failure resolves to null rather than
 * throwing — this is a display convenience, not a step that may fail a
 * report submission or a Verifier page load.
 */
class MapTilerReverseGeocoder implements ReverseGeocoder {
  constructor(private readonly apiKey: string) {}

  async resolve(longitude: number, latitude: number): Promise<ReverseGeocodeResult | null> {
    const latRounded = roundCoordinate(latitude);
    const lonRounded = roundCoordinate(longitude);
    const db = getServiceRoleClient();

    const { data: cached } = await db
      .from("reverse_geocode_cache")
      .select("resolved_address")
      .eq("lat_rounded", latRounded)
      .eq("lon_rounded", lonRounded)
      .eq("provider", "maptiler")
      .maybeSingle<{ resolved_address: string | null }>();

    if (cached) {
      return cached.resolved_address ? { address: cached.resolved_address, provider: "maptiler" } : null;
    }

    let resolvedAddress: string | null = null;
    try {
      const url = `https://api.maptiler.com/geocoding/${longitude},${latitude}.json?key=${this.apiKey}`;
      const response = await fetch(url);
      if (response.ok) {
        const body = (await response.json()) as { features?: Array<{ place_name?: string }> };
        resolvedAddress = body.features?.[0]?.place_name ?? null;
      }
    } catch {
      // Network/provider failure — fall through with resolvedAddress still
      // null; this is a display-convenience lookup, never a hard failure.
      resolvedAddress = null;
    }

    await db.from("reverse_geocode_cache").insert({
      lat_rounded: latRounded,
      lon_rounded: lonRounded,
      resolved_address: resolvedAddress,
      provider: "maptiler",
    });

    return resolvedAddress ? { address: resolvedAddress, provider: "maptiler" } : null;
  }
}

let cached: ReverseGeocoder | undefined;

/** Resolves the active adapter — MapTiler-backed if configured, otherwise the explicit null fallback. */
export function getReverseGeocoder(): ReverseGeocoder {
  if (cached) return cached;
  const env = getServerEnv();
  cached = env.MAPTILER_API_KEY ? new MapTilerReverseGeocoder(env.MAPTILER_API_KEY) : new NullReverseGeocoder();
  return cached;
}
