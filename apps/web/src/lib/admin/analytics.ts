import "server-only";
import type {
  IntegrationUsageSummary,
  ServiceHealthSummary,
  StorageUsageSummary,
  UserActivitySummary,
} from "@mboyo/domain";
import { ROLES } from "@mboyo/domain";
import { ApiError } from "../api/errors";
import { getServerEnv } from "../env.server";
import type { CommandDbClient } from "../command/types";

interface AnalysisJobFailureRow {
  report_id: string;
  error: string | null;
  attempts: number;
  created_at: string;
}

interface JobDurationRow {
  created_at: string;
  completed_at: string | null;
}

interface ModelLatencyRow {
  model_latency_ms: number | null;
}

interface FailedJobErrorRow {
  error: string | null;
}

const RECENT_FAILURE_LIMIT = 20;
const METRICS_WINDOW_DAYS = 7;
// apps/worker's processing.py's exact error-message prefixes for the two
// evidence-related failure paths (_fail_job's messages) — matched here in
// TypeScript rather than via a DB-side text filter, since this codebase has
// no dedicated upload-failure log table to query directly (see
// ServiceHealthSummary.evidenceDownloadFailureCount7d's doc comment).
const EVIDENCE_FAILURE_ERROR_PREFIXES = ["Evidence download failed:", "No report_evidence row found"];

function isEvidenceFailureError(error: string | null): boolean {
  if (!error) return false;
  return EVIDENCE_FAILURE_ERROR_PREFIXES.some((prefix) => error.startsWith(prefix));
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : (sorted[mid] ?? 0);
}

/**
 * Admin's "service health" summary (BLOCK 26, extended BLOCK 28 with job
 * duration / model latency / escalation count / evidence-download-failure
 * count) — analysis_jobs queue depth by status, recent failures, plus four
 * rolling-7-day metrics computed client-side over small raw-row queries
 * (same "TypeScript aggregation over a small view" pattern established by
 * getVerifierAnalytics in BLOCK 26 — no single SQL summary row exists for
 * any of these).
 */
export async function getServiceHealthSummary(db: CommandDbClient): Promise<ServiceHealthSummary> {
  const windowStart = new Date(Date.now() - METRICS_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [
    queuedResult,
    processingResult,
    failedResult,
    recentFailuresResult,
    jobDurationsResult,
    modelLatenciesResult,
    escalationCountResult,
    evidenceFailureCountResult,
  ] = await Promise.all([
    db.from("analysis_jobs").select("*", { count: "exact", head: true }).eq("status", "queued"),
    db.from("analysis_jobs").select("*", { count: "exact", head: true }).eq("status", "processing"),
    db.from("analysis_jobs").select("*", { count: "exact", head: true }).eq("status", "failed"),
    db
      .from("analysis_jobs")
      .select("report_id, error, attempts, created_at")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(RECENT_FAILURE_LIMIT)
      .returns<AnalysisJobFailureRow[]>(),
    db
      .from("analysis_jobs")
      .select("created_at, completed_at")
      .eq("status", "done")
      .gte("completed_at", windowStart)
      .returns<JobDurationRow[]>(),
    db
      .from("model_predictions")
      .select("model_latency_ms")
      .not("model_latency_ms", "is", null)
      .gte("created_at", windowStart)
      .returns<ModelLatencyRow[]>(),
    db
      .from("audit_events")
      .select("*", { count: "exact", head: true })
      .like("action", "escalation.%")
      .gte("created_at", windowStart),
    db
      .from("analysis_jobs")
      .select("error")
      .eq("status", "failed")
      .gte("created_at", windowStart)
      .returns<FailedJobErrorRow[]>(),
  ]);

  if (
    queuedResult.error ||
    processingResult.error ||
    failedResult.error ||
    recentFailuresResult.error ||
    jobDurationsResult.error ||
    modelLatenciesResult.error ||
    escalationCountResult.error ||
    evidenceFailureCountResult.error
  ) {
    throw new ApiError("internal_error", "Gagal memuat ringkasan kesehatan layanan.");
  }

  const durationsSeconds = (jobDurationsResult.data ?? [])
    .filter((row): row is JobDurationRow & { completed_at: string } => row.completed_at !== null)
    .map((row) => (new Date(row.completed_at).getTime() - new Date(row.created_at).getTime()) / 1000);

  const latencies = (modelLatenciesResult.data ?? [])
    .map((row) => row.model_latency_ms)
    .filter((value): value is number => value !== null);

  return {
    analysisJobsQueued: queuedResult.count ?? 0,
    analysisJobsProcessing: processingResult.count ?? 0,
    analysisJobsFailed: failedResult.count ?? 0,
    recentFailures: (recentFailuresResult.data ?? []).map((row) => ({
      reportId: row.report_id,
      error: row.error,
      attempts: row.attempts,
      createdAt: row.created_at,
    })),
    medianJobDurationSeconds: median(durationsSeconds),
    medianModelLatencyMs: median(latencies),
    escalationCount7d: escalationCountResult.count ?? 0,
    evidenceDownloadFailureCount7d: (evidenceFailureCountResult.data ?? []).filter((row) =>
      isEvidenceFailureError(row.error),
    ).length,
  };
}

/**
 * Storage usage summary — sums object sizes via Storage's own `.list()`
 * metadata (no prior precedent in this codebase; confirmed by research
 * that no aggregation of this kind existed anywhere before this block).
 * Uses the RLS-scoped client's own Storage access (now granted via this
 * block's report_evidence_bucket_admin_select/generated_exports_bucket_admin_select
 * policies) rather than the service-role client, so this stays governed
 * by the same RLS-as-authorization-boundary discipline as every other
 * read in this codebase.
 */
export async function getStorageUsageSummaries(db: CommandDbClient): Promise<StorageUsageSummary[]> {
  const env = getServerEnv();
  const buckets = [env.SUPABASE_REPORTS_BUCKET, env.SUPABASE_EXPORTS_BUCKET];

  const summaries: StorageUsageSummary[] = [];
  for (const bucket of buckets) {
    let objectCount = 0;
    let totalBytes = 0;
    let offset = 0;
    const pageSize = 1000;

    for (;;) {
      const { data, error } = await db.storage.from(bucket).list(undefined, {
        limit: pageSize,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) {
        throw new ApiError("internal_error", `Gagal memuat penggunaan penyimpanan untuk bucket ${bucket}.`);
      }
      if (!data || data.length === 0) break;

      for (const object of data) {
        objectCount += 1;
        totalBytes += (object.metadata as { size?: number } | null)?.size ?? 0;
      }

      if (data.length < pageSize) break;
      offset += pageSize;
    }

    summaries.push({ bucket, objectCount, totalBytes });
  }

  return summaries;
}

interface RoleAssignmentCountRow {
  role: string;
}

/**
 * User activity summary — active (non-revoked) role_assignments count per
 * role. "Activity" here means "currently holds an active role assignment,"
 * not last-login/session tracking (no such tracking exists anywhere in
 * this schema) — a disclosed, honest scope for what "user activity" can
 * mean without inventing new tracking infrastructure this block doesn't
 * otherwise require.
 */
export async function getUserActivitySummary(db: CommandDbClient): Promise<UserActivitySummary[]> {
  const { data, error } = await db
    .from("role_assignments")
    .select("role")
    .is("revoked_at", null)
    .returns<RoleAssignmentCountRow[]>();

  if (error) {
    throw new ApiError("internal_error", "Gagal memuat ringkasan aktivitas pengguna.");
  }

  const countByRole = new Map<string, number>();
  for (const role of ROLES) countByRole.set(role, 0);
  for (const row of data ?? []) {
    countByRole.set(row.role, (countByRole.get(row.role) ?? 0) + 1);
  }

  return Array.from(countByRole.entries()).map(([role, activeUserCount]) => ({ role, activeUserCount }));
}

interface GeminiRequestRow {
  status: "succeeded" | "failed" | "timed_out" | "rate_limited";
}

/**
 * Integration usage — Gemini advisory request outcomes (org-wide, not
 * per-Verifier) plus registered push subscription count, the two optional
 * integrations this platform has (per docs/adr/0004 and BLOCK 25).
 */
export async function getIntegrationUsageSummary(db: CommandDbClient): Promise<IntegrationUsageSummary> {
  const [geminiResult, pushResult] = await Promise.all([
    db.from("gemini_advisory_requests").select("status").returns<GeminiRequestRow[]>(),
    db.from("push_subscriptions").select("*", { count: "exact", head: true }),
  ]);

  if (geminiResult.error || pushResult.error) {
    throw new ApiError("internal_error", "Gagal memuat ringkasan penggunaan integrasi.");
  }

  const geminiRows = geminiResult.data ?? [];

  return {
    geminiRequestCount: geminiRows.length,
    geminiSuccessCount: geminiRows.filter((row) => row.status === "succeeded").length,
    pushSubscriptionCount: pushResult.count ?? 0,
  };
}
