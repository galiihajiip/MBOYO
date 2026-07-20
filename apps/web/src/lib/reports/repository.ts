import type { ReportDraft } from "./types";

export interface ReportListItem {
  clientReportId: string;
  title: string;
  status: ReportDraft["status"] | "verified" | "rejected" | "needs_manual_review" | "analysis_completed";
  updatedAtClient: string;
  observedSeverity: ReportDraft["observedSeverity"];
}

/**
 * Storage seam for the report wizard and the Reporter's own-report screens.
 * Implemented by ../offline/dexie-report-repository.ts, backed by the
 * durable Dexie/IndexedDB queue in ../offline/ — per
 * docs/adr/0005-offline-indexeddb-workbox.md and
 * docs/architecture/SEQUENCE_FLOWS.md Diagram 3. Network sync itself
 * (Background Sync / service worker) is a separate concern layered on top
 * of this queue, not part of this interface.
 *
 * Every method is async since IndexedDB access is inherently asynchronous.
 */
export interface OfflineReportRepository {
  /** Creates or overwrites the draft for this clientReportId (autosave target). */
  saveDraft(draft: ReportDraft): Promise<void>;
  /** Reads back a previously saved draft, or null if none exists — powers "draft restored" on wizard mount. */
  getDraft(clientReportId: string): Promise<ReportDraft | null>;
  /** Returns the most recently updated draft still in draft_local status, if any — for resuming without a known id. */
  getLatestUnsubmittedDraft(): Promise<ReportDraft | null>;
  /** Marks a draft ready for sync (queued_offline) or attempts immediate submission depending on connectivity — the actual queue/sync mechanics belong to BLOCK 13. */
  submitDraft(draft: ReportDraft): Promise<SubmitResult>;
  /** Lists the Reporter's own reports (own-report screens), most recent first. */
  listOwnReports(): Promise<ReportListItem[]>;
  /** Fetches a single own report's detail; null if not found or not owned by the caller. */
  getOwnReport(clientReportId: string): Promise<ReportListItem | null>;
  /** Deletes a draft that has not yet been submitted — used by the Antrean Offline screen. */
  deleteDraft(clientReportId: string): Promise<void>;
}

export interface SubmitResult {
  ok: boolean;
  /** Human-readable reason on failure — surfaced verbatim in the UI, never swallowed. */
  error?: string;
}
