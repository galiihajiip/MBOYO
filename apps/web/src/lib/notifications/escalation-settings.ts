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

export async function listEscalationSettings(
  db: NotificationsDbClient,
  organizationId: string,
): Promise<EscalationSettingDto[]> {
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  if (isDemoMode) {
    return [
      {
        ruleType: "unverified_high_severity",
        value: { maxAgeHours: 2, targetRole: "verifier" },
        updatedAt: new Date().toISOString(),
      },
      {
        ruleType: "unassigned_critical_cluster",
        value: { maxAgeHours: 1, targetRole: "response_coordinator" },
        updatedAt: new Date().toISOString(),
      },
      {
        ruleType: "unassigned_high_priority_task",
        value: { maxAgeHours: 4, targetRole: "response_coordinator" },
        updatedAt: new Date().toISOString(),
      },
    ];
  }

  try {
    const { data, error } = await db
      .from("system_settings")
      .select("key, value, updated_at")
      .eq("organization_id", organizationId)
      .like("key", `${ESCALATION_KEY_PREFIX}%`)
      .returns<SystemSettingRow[]>();

    if (!error && data) {
      return data
        .filter((row): row is SystemSettingRow & { key: `escalation.${EscalationRuleType}` } =>
          (ESCALATION_RULE_TYPES as readonly string[]).includes(row.key.slice(ESCALATION_KEY_PREFIX.length)),
        )
        .map((row) => ({
          ruleType: row.key.slice(ESCALATION_KEY_PREFIX.length) as EscalationRuleType,
          value: row.value,
          updatedAt: row.updated_at,
        }));
    }
  } catch {}

  throw new ApiError("internal_error", "Gagal memuat aturan eskalasi.");
}

export async function updateEscalationSetting(
  db: NotificationsDbClient,
  organizationId: string,
  actorProfileId: string,
  ruleType: EscalationRuleType,
  value: Record<string, unknown>,
): Promise<EscalationSettingDto> {
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  if (isDemoMode) {
    return { ruleType, value, updatedAt: new Date().toISOString() };
  }

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
