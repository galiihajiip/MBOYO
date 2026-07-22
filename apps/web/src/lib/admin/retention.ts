import "server-only";
import type {
  CreateDeletionRequestInput,
  DeletionRequestStatus,
  PlaceLegalHoldInput,
  RetentionPolicyValue,
  ReviewDeletionRequestInput,
} from "@mboyo/domain";
import { retentionPolicySchema } from "@mboyo/domain";
import { ApiError } from "../api/errors";
import type { CommandDbClient } from "../command/types";

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
    throw new ApiError("not_found", "Data tidak ditemukan.");
  }
  if (error.code === VALIDATION_FAILED_SQLSTATE) {
    throw new ApiError("validation_failed", error.message);
  }
  throw new ApiError("internal_error", fallbackMessage);
}

// ============================================================================
// retention policy — read of the retention.* system_settings rows
// (BLOCK 27 migration seeds evidence_retention_days/audit_retention_days).
// ============================================================================

export interface RetentionPolicyDto {
  key: string;
  days: number;
  enabled: boolean;
  updatedAt: string;
}

interface SystemSettingRow {
  key: string;
  value: { days?: number; enabled?: boolean };
  updated_at: string;
}

const RETENTION_KEY_PREFIX = "retention.";

/** Lists the org's declared retention.* policy rows — the Auditor's "retention/deletion evidence" visibility and Admin's Pengaturan config display. Enforcement of these values is explicitly disclosed as not implemented (no scheduled job exists). */
export async function listRetentionPolicies(db: CommandDbClient, organizationId: string): Promise<RetentionPolicyDto[]> {
  const { data, error } = await db
    .from("system_settings")
    .select("key, value, updated_at")
    .eq("organization_id", organizationId)
    .like("key", `${RETENTION_KEY_PREFIX}%`)
    .returns<SystemSettingRow[]>();

  if (error) {
    throw new ApiError("internal_error", "Gagal memuat kebijakan retensi.");
  }

  return (data ?? []).map((row) => ({
    key: row.key.slice(RETENTION_KEY_PREFIX.length),
    days: row.value.days ?? 0,
    enabled: row.value.enabled ?? false,
    updatedAt: row.updated_at,
  }));
}

/**
 * Updates one retention.* policy row's declared value — validated against
 * retentionPolicySchema first. Writing here does not itself change any
 * enforcement behavior (no scheduled job reads these values yet, per this
 * migration's own disclosed scope) — this is the declared-policy record
 * an Auditor compares against actual data age, not a live control knob.
 * system_settings_admin_all RLS is the write-authorization boundary; the
 * write is unconditionally audited by system_settings_audit_trigger
 * (BLOCK 27), satisfying "every admin setting change is audited" here too.
 */
export async function updateRetentionPolicy(
  db: CommandDbClient,
  organizationId: string,
  actorProfileId: string,
  key: string,
  value: RetentionPolicyValue,
): Promise<RetentionPolicyDto> {
  const parsed = retentionPolicySchema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError("validation_failed", "Nilai kebijakan retensi tidak valid.", {
      value: parsed.error.issues.map((issue) => issue.message),
    });
  }

  const { data, error } = await db
    .from("system_settings")
    .update({ value: parsed.data, updated_by_profile_id: actorProfileId, updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("key", `${RETENTION_KEY_PREFIX}${key}`)
    .select("key, value, updated_at")
    .single<SystemSettingRow>();

  if (error || !data) {
    throw new ApiError("internal_error", "Gagal menyimpan kebijakan retensi.");
  }

  return {
    key,
    days: data.value.days ?? 0,
    enabled: data.value.enabled ?? false,
    updatedAt: data.updated_at,
  };
}

// ============================================================================
// deletion requests — placeholder workflow
// ============================================================================

interface DeletionRequestRow {
  id: string;
  requested_by_profile_id: string;
  subject_report_id: string | null;
  reason: string;
  status: DeletionRequestStatus;
  reviewed_by_profile_id: string | null;
  review_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface DeletionRequestDto {
  id: string;
  requestedByProfileId: string;
  subjectReportId: string | null;
  reason: string;
  status: DeletionRequestStatus;
  reviewedByProfileId: string | null;
  reviewNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

function toDeletionRequestDto(row: DeletionRequestRow): DeletionRequestDto {
  return {
    id: row.id,
    requestedByProfileId: row.requested_by_profile_id,
    subjectReportId: row.subject_report_id,
    reason: row.reason,
    status: row.status,
    reviewedByProfileId: row.reviewed_by_profile_id,
    reviewNotes: row.review_notes,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  };
}

/** Creates a deletion_requests row — RLS (deletion_requests_insert_own) scopes this to the caller's own requested_by_profile_id. */
export async function createDeletionRequest(
  db: CommandDbClient,
  requestedByProfileId: string,
  input: CreateDeletionRequestInput,
): Promise<DeletionRequestDto> {
  const { data, error } = await db
    .from("deletion_requests")
    .insert({
      requested_by_profile_id: requestedByProfileId,
      subject_report_id: input.subjectReportId ?? null,
      reason: input.reason,
    })
    .select("*")
    .single<DeletionRequestRow>();

  if (error || !data) {
    throw new ApiError("internal_error", "Gagal membuat permintaan penghapusan.");
  }

  return toDeletionRequestDto(data);
}

/** Lists deletion_requests visible to the caller — Admin sees all (deletion_requests_admin_all), Auditor sees all (deletion_requests_auditor_select), a Reporter/Verifier/Coordinator sees only their own (deletion_requests_select_own). */
export async function listDeletionRequests(db: CommandDbClient): Promise<DeletionRequestDto[]> {
  const { data, error } = await db
    .from("deletion_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<DeletionRequestRow[]>();

  if (error) {
    throw new ApiError("internal_error", "Gagal memuat daftar permintaan penghapusan.");
  }

  return (data ?? []).map(toDeletionRequestDto);
}

/** Reviews (approves/denies/marks completed) a deletion request — Admin-only, always audited via review_deletion_request(). */
export async function reviewDeletionRequest(
  db: CommandDbClient,
  deletionRequestId: string,
  input: ReviewDeletionRequestInput,
): Promise<DeletionRequestDto> {
  const { data, error } = await db
    .rpc("review_deletion_request", {
      p_deletion_request_id: deletionRequestId,
      p_status: input.status,
      p_review_notes: input.reviewNotes ?? null,
    })
    .single<DeletionRequestRow>();

  if (error) {
    translateRpcError(error, "Gagal meninjau permintaan penghapusan.");
  }
  if (!data) {
    throw new ApiError("internal_error", "Gagal meninjau permintaan penghapusan.");
  }

  return toDeletionRequestDto(data);
}

// ============================================================================
// legal holds — placeholder
// ============================================================================

interface LegalHoldRow {
  id: string;
  report_id: string | null;
  disaster_event_id: string | null;
  reason: string;
  placed_by_profile_id: string;
  placed_at: string;
  released_at: string | null;
  released_by_profile_id: string | null;
}

export interface LegalHoldDto {
  id: string;
  reportId: string | null;
  disasterEventId: string | null;
  reason: string;
  placedByProfileId: string;
  placedAt: string;
  releasedAt: string | null;
}

function toLegalHoldDto(row: LegalHoldRow): LegalHoldDto {
  return {
    id: row.id,
    reportId: row.report_id,
    disasterEventId: row.disaster_event_id,
    reason: row.reason,
    placedByProfileId: row.placed_by_profile_id,
    placedAt: row.placed_at,
    releasedAt: row.released_at,
  };
}

/** Lists legal_holds visible to the caller (Admin: all; Auditor: all read-only). */
export async function listLegalHolds(db: CommandDbClient): Promise<LegalHoldDto[]> {
  const { data, error } = await db
    .from("legal_holds")
    .select("*")
    .order("placed_at", { ascending: false })
    .returns<LegalHoldRow[]>();

  if (error) {
    throw new ApiError("internal_error", "Gagal memuat daftar penahanan hukum.");
  }

  return (data ?? []).map(toLegalHoldDto);
}

/** Places a legal hold on a report or disaster_event — Admin-only, always audited. */
export async function placeLegalHold(db: CommandDbClient, input: PlaceLegalHoldInput): Promise<LegalHoldDto> {
  const { data, error } = await db
    .rpc("place_legal_hold", {
      p_reason: input.reason,
      p_report_id: input.reportId ?? null,
      p_disaster_event_id: input.disasterEventId ?? null,
    })
    .single<LegalHoldRow>();

  if (error) {
    translateRpcError(error, "Gagal menempatkan penahanan hukum.");
  }
  if (!data) {
    throw new ApiError("internal_error", "Gagal menempatkan penahanan hukum.");
  }

  return toLegalHoldDto(data);
}

/** Releases an active legal hold — Admin-only, always audited. */
export async function releaseLegalHold(db: CommandDbClient, legalHoldId: string): Promise<LegalHoldDto> {
  const { data, error } = await db.rpc("release_legal_hold", { p_legal_hold_id: legalHoldId }).single<LegalHoldRow>();

  if (error) {
    translateRpcError(error, "Gagal melepaskan penahanan hukum.");
  }
  if (!data) {
    throw new ApiError("internal_error", "Gagal melepaskan penahanan hukum.");
  }

  return toLegalHoldDto(data);
}
