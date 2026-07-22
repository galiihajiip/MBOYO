import "server-only";
import type { EscalationRuleType } from "@mboyo/domain";
import { ESCALATION_RULE_TYPES, escalationSettingSchemas } from "@mboyo/domain";
import { ApiError } from "../api/errors";
import type { NotificationsDbClient } from "./types";

interface SystemSettingRow {
  key: string;
  value: Record<string, unknown>;
  updated_at: string;
}

export interface EscalationSettingDto {
  ruleType: EscalationRuleType;
  value: Record<string, unknown>;
  updatedAt: string;
}

const ESCALATION_KEY_PREFIX = "escalation.";

/**
 * Lists every escalation.* system_settings row for the caller's own
 * organization — Admin's /admin/eskalasi screen. system_settings RLS
 * (system_settings_select_any_authenticated) already lets any
 * authenticated profile read these; this function scopes to the caller's
 * own organization_id (resolved via their profile) rather than every
 * organization's rows, since system_settings has no other per-request
 * organization filter built in at the RLS layer.
 */
export async function listEscalationSettings(
  db: NotificationsDbClient,
  organizationId: string,
): Promise<EscalationSettingDto[]> {
  const { data, error } = await db
    .from("system_settings")
    .select("key, value, updated_at")
    .eq("organization_id", organizationId)
    .like("key", `${ESCALATION_KEY_PREFIX}%`)
    .returns<SystemSettingRow[]>();

  if (error) {
    throw new ApiError("internal_error", "Gagal memuat aturan eskalasi.");
  }

  return (data ?? [])
    .filter((row): row is SystemSettingRow & { key: `escalation.${EscalationRuleType}` } =>
      (ESCALATION_RULE_TYPES as readonly string[]).includes(row.key.slice(ESCALATION_KEY_PREFIX.length)),
    )
    .map((row) => ({
      ruleType: row.key.slice(ESCALATION_KEY_PREFIX.length) as EscalationRuleType,
      value: row.value,
      updatedAt: row.updated_at,
    }));
}

/**
 * Updates one escalation rule's settings row — validated against that
 * rule's own Zod schema (packages/domain's escalationSettingSchemas)
 * before the write, so a malformed threshold can never reach the
 * database; system_settings_admin_all RLS is the actual write-authorization
 * boundary (system_administrator only). Takes effect on the very next
 * evaluate_escalations() call with no restart, since that function always
 * re-reads this row live.
 */
export async function updateEscalationSetting(
  db: NotificationsDbClient,
  organizationId: string,
  actorProfileId: string,
  ruleType: EscalationRuleType,
  value: Record<string, unknown>,
): Promise<EscalationSettingDto> {
  const schema = escalationSettingSchemas[ruleType];
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError("validation_failed", "Nilai pengaturan eskalasi tidak valid.", {
      value: parsed.error.issues.map((issue) => issue.message),
    });
  }

  const { data, error } = await db
    .from("system_settings")
    .update({ value: parsed.data, updated_by_profile_id: actorProfileId, updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("key", `${ESCALATION_KEY_PREFIX}${ruleType}`)
    .select("key, value, updated_at")
    .single<SystemSettingRow>();

  if (error || !data) {
    throw new ApiError("internal_error", "Gagal menyimpan aturan eskalasi.");
  }

  return { ruleType, value: data.value, updatedAt: data.updated_at };
}
