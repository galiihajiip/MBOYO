import "server-only";
import type { SubmitLocationObservationInput } from "@mboyo/domain";
import { ApiError } from "../../api/errors";
import type { ReportsDbClient } from "./types";

/** Postgres error codes raised by record_geolocation_observation() (BLOCK 17 migration). */
const INSUFFICIENT_PRIVILEGE_SQLSTATE = "42501";
const INVALID_COORDINATES_SQLSTATE = "22023";

interface PostgrestLikeError {
  code?: string;
  message: string;
}

function translateRpcError(error: PostgrestLikeError): never {
  if (error.code === INSUFFICIENT_PRIVILEGE_SQLSTATE) {
    throw new ApiError("forbidden", "Laporan ini bukan milik Anda.");
  }
  if (error.code === INVALID_COORDINATES_SQLSTATE) {
    throw new ApiError("validation_failed", "Koordinat lokasi tidak valid.");
  }
  throw new ApiError("internal_error", "Gagal menyimpan lokasi laporan.");
}

export interface LocationObservationRow {
  id: string;
  report_id: string;
  /** [longitude, latitude] order for this pair, per this block's requirement — longitude always read/passed first. */
  longitude: number;
  latitude: number;
  accuracy_meters: string | null;
  captured_at_client: string;
  location_source: SubmitLocationObservationInput["source"];
  manual_address: string | null;
  distance_to_event_center_meters: string | null;
  outside_event_boundary: boolean | null;
  suspicious_pattern_flags: string[];
  /** 0..1 — see the migration's own comment: a corroboration signal, never a claim of ground truth. */
  confidence_signal: string | null;
  created_at: string;
}

export interface LocationObservationDto {
  id: string;
  reportId: string;
  longitude: number;
  latitude: number;
  accuracyMeters: number | null;
  capturedAtClient: string;
  source: SubmitLocationObservationInput["source"];
  manualAddress: string | null;
  distanceToEventCenterMeters: number | null;
  outsideEventBoundary: boolean | null;
  suspiciousPatternFlags: string[];
  confidenceSignal: number | null;
  createdAt: string;
}

function toLocationObservationDto(row: LocationObservationRow): LocationObservationDto {
  return {
    id: row.id,
    reportId: row.report_id,
    longitude: row.longitude,
    latitude: row.latitude,
    accuracyMeters: row.accuracy_meters === null ? null : Number(row.accuracy_meters),
    capturedAtClient: row.captured_at_client,
    source: row.location_source,
    manualAddress: row.manual_address,
    distanceToEventCenterMeters:
      row.distance_to_event_center_meters === null ? null : Number(row.distance_to_event_center_meters),
    outsideEventBoundary: row.outside_event_boundary,
    suspiciousPatternFlags: row.suspicious_pattern_flags,
    confidenceSignal: row.confidence_signal === null ? null : Number(row.confidence_signal),
    createdAt: row.created_at,
  };
}

/**
 * Records one location observation for a report — the ONLY sanctioned
 * write path (delegates entirely to record_geolocation_observation(), this
 * block's migration, which performs ownership validation, coordinate-range
 * validation, and the advisory distance/boundary/suspicious-pattern signal
 * computation atomically). A report may accumulate several observations
 * over time (a Reporter retrying GPS for a better fix) — this function
 * always inserts a new row, never updates an existing one, matching
 * docs/product/DOMAIN_MODEL.md's geolocation_observation design and the
 * table's insert-only RLS (BLOCK 08: no UPDATE/DELETE policy for any role).
 *
 * Longitude is passed as the RPC's p_longitude/first coordinate parameter
 * and latitude second — matching st_makepoint(lon, lat) inside the
 * function and this block's explicit "GeoJSON must use [longitude,
 * latitude]" requirement. Getting this order backwards here would silently
 * misplace every recorded location without necessarily looking wrong for
 * many real-world coordinates (lat/lon magnitudes overlap near the
 * equator) — this comment exists at the one call site where the order
 * could be swapped by mistake.
 */
export async function recordLocationObservation(
  db: ReportsDbClient,
  reportId: string,
  input: SubmitLocationObservationInput,
): Promise<LocationObservationDto> {
  const { data, error } = await db
    .rpc("record_geolocation_observation", {
      p_report_id: reportId,
      p_longitude: input.longitude,
      p_latitude: input.latitude,
      p_accuracy_meters: input.accuracyMeters ?? null,
      p_captured_at_client: input.capturedAtClient ?? null,
      p_location_source: input.source,
      p_manual_address: input.manualAddress ?? null,
    })
    .single<LocationObservationRow>();

  if (error) {
    translateRpcError(error);
  }
  if (!data) {
    throw new ApiError("internal_error", "Gagal menyimpan lokasi laporan.");
  }

  return toLocationObservationDto(data);
}

/**
 * Lists every observation recorded for a report, most recent first — used
 * by the Verifier detail view to show source/accuracy/timestamp/boundary/
 * distance for each capture attempt, not just the latest one (a Verifier
 * judging location trust benefits from seeing that, e.g., three GPS
 * attempts all landed within a few meters of each other, vs. a single
 * uncorroborated manual pin). RLS (geolocation_observations_verifier_select
 * etc., BLOCK 08) is the authorization boundary for which reports' rows are
 * visible at all — this function applies no role logic itself.
 */
export async function listLocationObservations(
  db: ReportsDbClient,
  reportId: string,
): Promise<LocationObservationDto[]> {
  const { data, error } = await db
    .from("geolocation_observations")
    .select(
      "id, report_id, longitude, latitude, accuracy_meters, captured_at_client, location_source, manual_address, distance_to_event_center_meters, outside_event_boundary, suspicious_pattern_flags, confidence_signal, created_at",
    )
    .eq("report_id", reportId)
    .order("created_at", { ascending: false })
    .returns<LocationObservationRow[]>();

  if (error) {
    throw new ApiError("internal_error", "Gagal memuat data lokasi laporan.");
  }

  return (data ?? []).map(toLocationObservationDto);
}
