import "server-only";
import { ApiError } from "../api/errors";
import type { CommandDbClient } from "../command/types";

export interface AuditEventFilters {
  entityType?: string;
  action?: string;
  actorProfileId?: string;
}

interface AuditEventRow {
  id: string;
  entity_type: string;
  entity_id: string;
  actor_profile_id: string | null;
  action: string;
  detail: Record<string, unknown>;
  occurred_at: string;
}

export interface AuditEventDto {
  id: string;
  entityType: string;
  entityId: string;
  actorProfileId: string | null;
  action: string;
  detail: Record<string, unknown>;
  occurredAt: string;
}

const AUDIT_EVENT_PAGE_SIZE = 100;

export async function listAuditEvents(db: CommandDbClient, filters: AuditEventFilters): Promise<AuditEventDto[]> {
  try {
    let query = db.from("audit_events").select("*");
    if (filters.entityType) query = query.eq("entity_type", filters.entityType);
    if (filters.action) query = query.eq("action", filters.action);
    if (filters.actorProfileId) query = query.eq("actor_profile_id", filters.actorProfileId);

    const { data, error } = await query
      .order("occurred_at", { ascending: false })
      .limit(AUDIT_EVENT_PAGE_SIZE)
      .returns<AuditEventRow[]>();

    if (!error && data) {
      return data.map((row) => ({
        id: row.id,
        entityType: row.entity_type,
        entityId: row.entity_id,
        actorProfileId: row.actor_profile_id,
        action: row.action,
        detail: row.detail,
        occurredAt: row.occurred_at,
      }));
    }
  } catch {}

  throw new ApiError("internal_error", "Gagal memuat jejak audit.");
}

export async function getAuditEventById(db: CommandDbClient, auditEventId: string): Promise<AuditEventDto> {
  try {
    const { data } = await db.from("audit_events").select("*").eq("id", auditEventId).maybeSingle<AuditEventRow>();
    if (data) {
      return {
        id: data.id,
        entityType: data.entity_type,
        entityId: data.entity_id,
        actorProfileId: data.actor_profile_id,
        action: data.action,
        detail: data.detail,
        occurredAt: data.occurred_at,
      };
    }
  } catch {}

  throw new ApiError("not_found", "Jejak audit tidak ditemukan.");
}
