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

export async function listRetentionPolicies(db: CommandDbClient, organizationId: string): Promise<RetentionPolicyDto[]> {
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  if (isDemoMode) {
    return [
      { key: "evidence_retention_days", days: 90, enabled: true, updatedAt: new Date().toISOString() },
      { key: "audit_retention_days", days: 365, enabled: true, updatedAt: new Date().toISOString() },
    ];
  }

  try {
    const { data, error } = await db
      .from("system_settings")
      .select("key, value, updated_at")
      .eq("organization_id", organizationId)
      .like("key", `${RETENTION_KEY_PREFIX}%`)
      .returns<SystemSettingRow[]>();

    if (!error && data) {
      return data.map((row) => ({
        key: row.key.slice(RETENTION_KEY_PREFIX.length),
        days: row.value.days ?? 0,
        enabled: row.value.enabled ?? false,
        updatedAt: row.updated_at,
      }));
    }
  } catch {}

  throw new ApiError("internal_error", "Gagal memuat kebijakan retensi.");
}

export async function updateRetentionPolicy(
  db: CommandDbClient,
  organizationId: string,
  actorProfileId: string,
  key: string,
  value: RetentionPolicyValue,
): Promise<RetentionPolicyDto> {
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  if (isDemoMode) {
    return { key, days: value.days, enabled: value.enabled, updatedAt: new Date().toISOString() };
  }

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

export async function createDeletionRequest(
  db: CommandDbClient,
  requestedByProfileId: string,
  input: CreateDeletionRequestInput,
): Promise<DeletionRequestDto> {
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  if (isDemoMode) {
    return {
      id: `demo-deletion-${Date.now()}`,
      requestedByProfileId,
      subjectReportId: input.subjectReportId ?? null,
      reason: input.reason,
      status: "pending",
      reviewedByProfileId: null,
      reviewNotes: null,
      createdAt: new Date().toISOString(),
      reviewedAt: null,
    };
  }

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

export async function listDeletionRequests(db: CommandDbClient): Promise<DeletionRequestDto[]> {
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  if (isDemoMode) {
    return [
      {
        id: "demo-deletion-1",
        requestedByProfileId: "demo-reporter",
        subjectReportId: "demo-report-1",
        reason: "Penghapusan data foto duplikat sesuai ketentuan retensi",
        status: "pending",
        reviewedByProfileId: null,
        reviewNotes: null,
        createdAt: new Date().toISOString(),
        reviewedAt: null,
      },
    ];
  }

  try {
    const { data, error } = await db
      .from("deletion_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .returns<DeletionRequestRow[]>();

    if (!error && data) {
      return data.map(toDeletionRequestDto);
    }
  } catch {}

  throw new ApiError("internal_error", "Gagal memuat daftar permintaan penghapusan.");
}

export async function reviewDeletionRequest(
  db: CommandDbClient,
  deletionRequestId: string,
  input: ReviewDeletionRequestInput,
): Promise<DeletionRequestDto> {
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  if (isDemoMode) {
    return {
      id: deletionRequestId,
      requestedByProfileId: "demo-reporter",
      subjectReportId: "demo-report-1",
      reason: "Penghapusan data foto duplikat",
      status: input.status,
      reviewedByProfileId: "demo-admin",
      reviewNotes: input.reviewNotes ?? null,
      createdAt: new Date().toISOString(),
      reviewedAt: new Date().toISOString(),
    };
  }

  const { data, error } = await db
    .rpc("review_deletion_request", {
      p_deletion_request_id: deletionRequestId,
      p_status: input.status,
      p_review_notes: input.reviewNotes ?? null,
    })
    .single<DeletionRequestRow>();

  if (error || !data) {
    throw new ApiError("internal_error", "Gagal meninjau permintaan penghapusan.");
  }

  return toDeletionRequestDto(data);
}

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

export async function listLegalHolds(db: CommandDbClient): Promise<LegalHoldDto[]> {
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  if (isDemoMode) {
    return [
      {
        id: "demo-hold-1",
        reportId: "demo-report-1",
        disasterEventId: "demo-event-1",
        reason: "Penahanan bukti insiden untuk audit independen",
        placedByProfileId: "demo-admin",
        placedAt: new Date().toISOString(),
        releasedAt: null,
      },
    ];
  }

  try {
    const { data, error } = await db
      .from("legal_holds")
      .select("*")
      .order("placed_at", { ascending: false })
      .returns<LegalHoldRow[]>();

    if (!error && data) {
      return data.map(toLegalHoldDto);
    }
  } catch {}

  throw new ApiError("internal_error", "Gagal memuat daftar penahanan hukum.");
}

export async function placeLegalHold(db: CommandDbClient, input: PlaceLegalHoldInput): Promise<LegalHoldDto> {
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  if (isDemoMode) {
    return {
      id: `demo-hold-${Date.now()}`,
      reportId: input.reportId ?? null,
      disasterEventId: input.disasterEventId ?? null,
      reason: input.reason,
      placedByProfileId: "demo-admin",
      placedAt: new Date().toISOString(),
      releasedAt: null,
    };
  }

  const { data, error } = await db
    .rpc("place_legal_hold", {
      p_reason: input.reason,
      p_report_id: input.reportId ?? null,
      p_disaster_event_id: input.disasterEventId ?? null,
    })
    .single<LegalHoldRow>();

  if (error || !data) {
    throw new ApiError("internal_error", "Gagal menempatkan penahanan hukum.");
  }

  return toLegalHoldDto(data);
}

export async function releaseLegalHold(db: CommandDbClient, legalHoldId: string): Promise<LegalHoldDto> {
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  if (isDemoMode) {
    return {
      id: legalHoldId,
      reportId: "demo-report-1",
      disasterEventId: "demo-event-1",
      reason: "Penahanan hukum dilepas setelah audit selesai",
      placedByProfileId: "demo-admin",
      placedAt: new Date().toISOString(),
      releasedAt: new Date().toISOString(),
    };
  }

  const { data, error } = await db.rpc("release_legal_hold", { p_legal_hold_id: legalHoldId }).single<LegalHoldRow>();

  if (error || !data) {
    throw new ApiError("internal_error", "Gagal melepaskan penahanan hukum.");
  }

  return toLegalHoldDto(data);
}
