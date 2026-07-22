import { z } from "zod";

/**
 * Shared shapes for BLOCK 26's role-specific analytics — these are plain
 * response-shape types (not write-command schemas, since every analytics
 * endpoint is read-only), kept here so apps/web's service layer and any
 * future typed client share one definition.
 */

// ============================================================================
// Verifier analytics
// ============================================================================

export interface DistributionBucket {
  label: string;
  count: number;
}

export interface VerifierAnalytics {
  reviewCount: number;
  agreementRate: number;
  overrideRate: number;
  medianReviewTimeSeconds: number | null;
  medianQueueAgeSeconds: number | null;
  queueAgeDistribution: DistributionBucket[];
  qualityDistribution: DistributionBucket[];
}

// ============================================================================
// Coordinator analytics — extends BLOCK 24's AnalyticsBreakdown (severity/
// status/region) with response SLA and a simple submission timeline, kept
// as a separate export here (not touching lib/command/analytics.ts's
// existing shape) so the two remain independently versioned.
// ============================================================================

export interface ResponseSlaSummary {
  medianResponseTimeSeconds: number | null;
  overdueCount: number;
  onTimeCompletedCount: number;
}

export interface TimelinePoint {
  date: string;
  count: number;
}

// ============================================================================
// Admin analytics
// ============================================================================

export interface ServiceHealthSummary {
  analysisJobsQueued: number;
  analysisJobsProcessing: number;
  analysisJobsFailed: number;
  recentFailures: { reportId: string; error: string | null; attempts: number; createdAt: string }[];
  /** Median seconds from analysis_jobs.created_at to completed_at, over 'done' jobs completed in the last 7 days. Null when no completed jobs exist in that window. */
  medianJobDurationSeconds: number | null;
  /** Median apps/ml-api /predict latency_ms, over model_predictions with a captured model_latency_ms in the last 7 days. Null when none captured. */
  medianModelLatencyMs: number | null;
  /** Count of audit_events with action like 'escalation.%' in the last 7 days — see evaluate_escalations() (BLOCK 25), which appends exactly one such event per newly-raised (deduplicated) escalation. */
  escalationCount7d: number;
  /** report_evidence upload attempts that failed validation/processing — this codebase has no dedicated upload-failure log table, so this is disclosed as analysisJobsFailed's subset caused specifically by a missing/undownloadable evidence file, not a general upload-failure counter. See OBSERVABILITY.md. */
  evidenceDownloadFailureCount7d: number;
}

export interface StorageUsageSummary {
  bucket: string;
  objectCount: number;
  totalBytes: number;
}

export interface UserActivitySummary {
  role: string;
  activeUserCount: number;
}

export interface IntegrationUsageSummary {
  geminiRequestCount: number;
  geminiSuccessCount: number;
  pushSubscriptionCount: number;
}

// ============================================================================
// Auditor analytics
// ============================================================================

export interface DecisionLineageEntry {
  reviewId: string;
  reportId: string;
  verifierProfileId: string;
  decision: string;
  decidedAt: string;
  supersedesReviewId: string | null;
}

export interface ModelUsageSummary {
  modelRegistryEntryId: string;
  version: string;
  isActive: boolean;
  predictionCount: number;
}

export interface GeminiUsageSummary {
  totalRequests: number;
  succeededCount: number;
  failedCount: number;
  timedOutCount: number;
  rateLimitedCount: number;
}

export const analyticsWindowSchema = z.object({
  sinceDays: z.number().int().min(1).max(365).optional(),
});
export type AnalyticsWindow = z.infer<typeof analyticsWindowSchema>;
