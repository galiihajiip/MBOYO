import "server-only";
import { ApiError } from "../api/errors";
import { toCommandMapReportDto, type CommandDbClient, type CommandMapReportDto, type CommandMapReportRow } from "./types";
export type { CommandMapReportDto } from "./types";

export interface MapBoundingBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

/**
 * Verified reports with a recorded location, for Peta Krisis, queried from
 * public.command_map_reports (BLOCK 24 migration — security_invoker, so RLS
 * on reports/geolocation_observations/model_predictions still governs
 * visibility exactly as it does everywhere else). An optional bbox narrows
 * to the current map viewport — filtered here in TypeScript (not a
 * dedicated RPC) since the view's longitude/latitude columns are plain
 * filterable numerics, matching BLOCK 23's "filter in TypeScript over a
 * security_invoker view" precedent rather than reusing reports_in_bbox
 * (which returns raw reports rows, not this view's joined shape).
 */
export async function listCommandMapReports(
  db: CommandDbClient,
  options: { disasterEventId?: string; bbox?: MapBoundingBox } = {},
): Promise<CommandMapReportDto[]> {
  let query = db.from("command_map_reports").select("*");

  if (options.disasterEventId) {
    query = query.eq("disaster_event_id", options.disasterEventId);
  }
  if (options.bbox) {
    query = query
      .gte("longitude", options.bbox.minLon)
      .lte("longitude", options.bbox.maxLon)
      .gte("latitude", options.bbox.minLat)
      .lte("latitude", options.bbox.maxLat);
  }

  const { data, error } = await query.returns<CommandMapReportRow[]>();

  if (error) {
    throw new ApiError("internal_error", "Gagal memuat laporan untuk peta krisis.");
  }

  return (data ?? []).map(toCommandMapReportDto);
}

interface GeoJsonPolygon {
  type: "Polygon";
  coordinates: [number, number][][];
}

/**
 * A disaster_event's geofence boundary as a [lon,lat] outer ring — or null
 * if the event has no geofence configured (event/geofence configuration
 * itself remains an Admin-block stub) or its geometry isn't a simple
 * Polygon. Matches components/map/MapPin.tsx's existing
 * geofenceRingLonLat prop shape exactly, so the same outline-rendering
 * effect can be reused for Peta Krisis.
 */
export async function getDisasterEventGeofenceRing(
  db: CommandDbClient,
  disasterEventId: string,
): Promise<[number, number][] | null> {
  const result: { data: unknown; error: { message: string } | null } = await db.rpc(
    "disaster_event_geofence_geojson",
    { p_disaster_event_id: disasterEventId },
  );

  if (result.error || typeof result.data !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(result.data) as GeoJsonPolygon;
    if (parsed.type !== "Polygon" || !parsed.coordinates[0]) {
      return null;
    }
    return parsed.coordinates[0];
  } catch {
    return null;
  }
}
