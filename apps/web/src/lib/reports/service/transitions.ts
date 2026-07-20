import "server-only";
import type { SubmitVerificationDecisionInput, ArchiveReportInput } from "@mboyo/domain";
import { ApiError } from "../../api/errors";
import { toReportSummaryDto, type ReportRow, type ReportsDbClient, type ReportSummaryDto } from "./types";

/** Postgres error codes raised by the RPC functions (see the BLOCK 16 migration) — mapped to stable ApiErrorCodes here, once. */
const PRECONDITION_FAILED_SQLSTATE = "P0001";
const NOT_FOUND_SQLSTATE = "P0002";
const INSUFFICIENT_PRIVILEGE_SQLSTATE = "42501";

interface PostgrestLikeError {
  code?: string;
  message: string;
}

function translateRpcError(error: PostgrestLikeError): never {
  if (error.code === INSUFFICIENT_PRIVILEGE_SQLSTATE) {
    throw new ApiError("forbidden", "Anda tidak memiliki izin untuk melakukan tindakan ini.");
  }
  if (error.code === NOT_FOUND_SQLSTATE) {
    throw new ApiError("not_found", "Laporan tidak ditemukan.");
  }
  if (error.code === PRECONDITION_FAILED_SQLSTATE) {
    throw new ApiError(
      "invalid_transition",
      "Laporan tidak berada dalam status yang valid untuk tindakan ini.",
    );
  }
  throw new ApiError("internal_error", "Gagal memproses perubahan status laporan.");
}

/**
 * Submits a Verifier's confirm/override/reject/request_info/escalate
 * decision — the ONLY domain command that may move a report's status out
 * of analysis_completed/needs_manual_review (docs/product/STATE_MACHINES.md).
 * Delegates entirely to the submit_verification_decision() RPC (this
 * block's migration) for the actual actor/precondition validation and
 * atomic insert+update+audit — this function's job is purely translating
 * that RPC's Postgres-level errors into stable ApiErrorCodes and its
 * success row into the shared DTO shape, never re-implementing the
 * transition logic in TypeScript (which would let application code and
 * database constraint drift apart).
 */
export async function submitVerificationDecision(
  db: ReportsDbClient,
  reportId: string,
  input: SubmitVerificationDecisionInput,
): Promise<ReportSummaryDto> {
  const { data, error } = await db
    .rpc("submit_verification_decision", {
      p_report_id: reportId,
      p_decision: input.decision,
      p_override_severity: input.overrideSeverity ?? null,
      p_notes: input.notes ?? null,
      p_reject_reason_category: input.rejectReasonCategory ?? null,
    })
    .single<ReportRow>();

  if (error) {
    translateRpcError(error);
  }
  if (!data) {
    throw new ApiError("internal_error", "Gagal memproses keputusan verifikasi.");
  }

  return toReportSummaryDto(data);
}

/**
 * Archives a verified/rejected report — the System Administrator's manual
 * retention-management path. Same delegation shape as
 * submitVerificationDecision: all actor/precondition enforcement lives in
 * archive_report() (this block's migration), this function only translates.
 */
export async function archiveReport(
  db: ReportsDbClient,
  reportId: string,
  input: ArchiveReportInput,
): Promise<ReportSummaryDto> {
  const { data, error } = await db
    .rpc("archive_report", { p_report_id: reportId, p_reason: input.reason ?? null })
    .single<ReportRow>();

  if (error) {
    translateRpcError(error);
  }
  if (!data) {
    throw new ApiError("internal_error", "Gagal mengarsipkan laporan.");
  }

  return toReportSummaryDto(data);
}
