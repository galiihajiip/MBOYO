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

export async function listCommandMapReports(
  db: CommandDbClient,
  options: { disasterEventId?: string; bbox?: MapBoundingBox } = {},
): Promise<CommandMapReportDto[]> {
  try {
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
    if (!error && data) {
      return data.map(toCommandMapReportDto);
    }
  } catch {}

  throw new ApiError("internal_error", "Gagal memuat laporan untuk peta krisis.");
}

interface GeoJsonPolygon {
  type: "Polygon";
  coordinates: [number, number][][];
}

export async function getDisasterEventGeofenceRing(
  db: CommandDbClient,
  disasterEventId: string,
): Promise<[number, number][] | null> {
  try {
    const result: { data: unknown; error: { message: string } | null } = await db.rpc(
      "disaster_event_geofence_geojson",
      { p_disaster_event_id: disasterEventId },
    );

    if (result.error || typeof result.data !== "string") {
      return null;
    }

    const parsed = JSON.parse(result.data) as GeoJsonPolygon;
    if (parsed.type !== "Polygon" || !parsed.coordinates[0]) {
      return null;
    }
    return parsed.coordinates[0];
  } catch {
    return null;
  }
}
