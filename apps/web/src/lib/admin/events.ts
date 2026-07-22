import "server-only";
import type { CreateDisasterEventInput, DisasterEventStatus, UpdateDisasterEventInput } from "@mboyo/domain";
import { ApiError } from "../api/errors";
import type { CommandDbClient } from "../command/types";

interface DisasterEventRow {
  id: string;
  organization_id: string;
  name: string;
  status: DisasterEventStatus;
  starts_at: string;
  ends_at: string | null;
}

export interface DisasterEventDto {
  id: string;
  organizationId: string;
  name: string;
  status: DisasterEventStatus;
  startsAt: string;
  endsAt: string | null;
}

function toDisasterEventDto(row: DisasterEventRow): DisasterEventDto {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  };
}

const NOT_FOUND_SQLSTATE = "P0002";
const INSUFFICIENT_PRIVILEGE_SQLSTATE = "42501";
const VALIDATION_FAILED_SQLSTATE = "22023";

interface PostgrestLikeError {
  code?: string;
  message: string;
}

function translateRpcError(error: PostgrestLikeError, fallbackMessage: string): never {
  if (error.code === INSUFFICIENT_PRIVILEGE_SQLSTATE) {
    throw new ApiError("forbidden", "Anda tidak memiliki izin untuk melakukan tindakan ini.");
  }
  if (error.code === NOT_FOUND_SQLSTATE) {
    throw new ApiError("not_found", "Event bencana tidak ditemukan.");
  }
  if (error.code === VALIDATION_FAILED_SQLSTATE) {
    throw new ApiError("validation_failed", error.message);
  }
  throw new ApiError("internal_error", fallbackMessage);
}

/** Lists every disaster_events row the caller's RLS permits — disaster_events_select_any_authenticated grants this to any authenticated profile. */
export async function listDisasterEvents(db: CommandDbClient): Promise<DisasterEventDto[]> {
  const { data, error } = await db
    .from("disaster_events")
    .select("id, organization_id, name, status, starts_at, ends_at")
    .order("starts_at", { ascending: false })
    .returns<DisasterEventRow[]>();

  if (error) {
    throw new ApiError("internal_error", "Gagal memuat daftar event bencana.");
  }

  return (data ?? []).map(toDisasterEventDto);
}

/** Creates a disaster_event — Admin-only, geofence accepted as GeoJSON text and converted server-side. */
export async function createDisasterEvent(db: CommandDbClient, input: CreateDisasterEventInput): Promise<DisasterEventDto> {
  const { data, error } = await db
    .rpc("create_disaster_event", {
      p_name: input.name,
      p_geofence_geojson: input.geofenceGeoJson ?? null,
      p_starts_at: input.startsAt ?? new Date().toISOString(),
    })
    .single<DisasterEventRow>();

  if (error) {
    translateRpcError(error, "Gagal membuat event bencana.");
  }
  if (!data) {
    throw new ApiError("internal_error", "Gagal membuat event bencana.");
  }

  return toDisasterEventDto(data);
}

/** Updates a disaster_event's name/status/geofence/ends_at — every field optional, only provided fields change. */
export async function updateDisasterEvent(
  db: CommandDbClient,
  disasterEventId: string,
  input: UpdateDisasterEventInput,
): Promise<DisasterEventDto> {
  const { data, error } = await db
    .rpc("update_disaster_event", {
      p_disaster_event_id: disasterEventId,
      p_name: input.name ?? null,
      p_status: input.status ?? null,
      p_geofence_geojson: input.geofenceGeoJson ?? null,
      p_ends_at: input.endsAt ?? null,
    })
    .single<DisasterEventRow>();

  if (error) {
    translateRpcError(error, "Gagal memperbarui event bencana.");
  }
  if (!data) {
    throw new ApiError("internal_error", "Gagal memperbarui event bencana.");
  }

  return toDisasterEventDto(data);
}
