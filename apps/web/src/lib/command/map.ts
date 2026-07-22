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
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  if (isDemoMode) {
    return [
      {
        id: "demo-report-1",
        disasterEventId: "demo-event-1",
        description: "Bangunan retak parah dan sebagian atap roboh",
        escalated: true,
        submittedAt: new Date().toISOString(),
        longitude: 106.8272,
        latitude: -6.1754,
        topSeverity: "destroyed",
        incidentClusterId: "demo-cluster-1",
      },
      {
        id: "demo-report-2",
        disasterEventId: "demo-event-1",
        description: "Kerusakan tembok dan fondasi retak",
        escalated: false,
        submittedAt: new Date().toISOString(),
        longitude: 106.832,
        latitude: -6.178,
        topSeverity: "major_damage",
        incidentClusterId: "demo-cluster-1",
      },
      {
        id: "demo-report-3",
        disasterEventId: "demo-event-1",
        description: "Atap genteng sebagian runtuh",
        escalated: false,
        submittedAt: new Date().toISOString(),
        longitude: 106.815,
        latitude: -6.172,
        topSeverity: "minor_damage",
        incidentClusterId: null,
      },
    ];
  }

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
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  if (isDemoMode) {
    return [
      [106.81, -6.16],
      [106.84, -6.16],
      [106.84, -6.19],
      [106.81, -6.19],
      [106.81, -6.16],
    ];
  }

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
