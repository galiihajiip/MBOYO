import { dexieReportRepository } from "../offline/dexie-report-repository";
import type { OfflineReportRepository } from "./repository";

/**
 * Resolves the active OfflineReportRepository implementation — now the
 * real Dexie/IndexedDB-backed repository (lib/offline/dexie-report-repository.ts),
 * replacing BLOCK 12's temporary mock adapter. Call sites depend only on
 * the OfflineReportRepository interface and are unaffected by this swap.
 */
export function useReportRepository(): OfflineReportRepository {
  return dexieReportRepository;
}
