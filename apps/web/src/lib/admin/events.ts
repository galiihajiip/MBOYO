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

export async function listDisasterEvents(db: CommandDbClient): Promise<DisasterEventDto[]> {
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  if (isDemoMode) {
    return [
      {
        id: "demo-event-1",
        organizationId: "demo-org-1",
        name: "Gempa Bumi & Tanah Longsor Jawa Barat 2026",
        status: "active",
        startsAt: new Date().toISOString(),
        endsAt: null,
      },
    ];
  }

  try {
    const { data, error } = await db
      .from("disaster_events")
      .select("id, organization_id, name, status, starts_at, ends_at")
      .order("starts_at", { ascending: false })
      .returns<DisasterEventRow[]>();

    if (!error && data) {
      return data.map(toDisasterEventDto);
    }
  } catch {}

  throw new ApiError("internal_error", "Gagal memuat daftar event bencana.");
}

export async function createDisasterEvent(db: CommandDbClient, input: CreateDisasterEventInput): Promise<DisasterEventDto> {
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  if (isDemoMode) {
    return {
      id: `demo-event-${Date.now()}`,
      organizationId: "demo-org-1",
      name: input.name,
      status: "active",
      startsAt: input.startsAt ?? new Date().toISOString(),
      endsAt: null,
    };
  }

  const { data, error } = await db
    .rpc("create_disaster_event", {
      p_name: input.name,
      p_geofence_geojson: input.geofenceGeoJson ?? null,
      p_starts_at: input.startsAt ?? new Date().toISOString(),
    })
    .single<DisasterEventRow>();

  if (error || !data) {
    throw new ApiError("internal_error", "Gagal membuat event bencana.");
  }

  return toDisasterEventDto(data);
}

export async function updateDisasterEvent(
  db: CommandDbClient,
  disasterEventId: string,
  input: UpdateDisasterEventInput,
): Promise<DisasterEventDto> {
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  if (isDemoMode) {
    return {
      id: disasterEventId,
      organizationId: "demo-org-1",
      name: input.name ?? "Gempa Bumi & Tanah Longsor Jawa Barat 2026",
      status: input.status ?? "active",
      startsAt: new Date().toISOString(),
      endsAt: input.endsAt ?? null,
    };
  }

  const { data, error } = await db
    .rpc("update_disaster_event", {
      p_disaster_event_id: disasterEventId,
      p_name: input.name ?? null,
      p_status: input.status ?? null,
      p_geofence_geojson: input.geofenceGeoJson ?? null,
      p_ends_at: input.endsAt ?? null,
    })
    .single<DisasterEventRow>();

  if (error || !data) {
    throw new ApiError("internal_error", "Gagal memperbarui event bencana.");
  }

  return toDisasterEventDto(data);
}
