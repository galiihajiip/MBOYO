import type { SeverityClass } from "@mboyo/domain";

/**
 * A report draft as it exists client-side, before or during sync — the
 * shape the report wizard (docs/product/SCREEN_INVENTORY.md "Buat
 * Laporan") reads and writes. This is intentionally richer than the
 * current `reports` table in supabase/migrations/20260716153709_core_schema.sql
 * (which only has `description`, not `title`/observed severity/contact
 * preference/consent) — BLOCK 13's offline repository and a later schema
 * migration are expected to reconcile the two; this block's job is the
 * wizard and its storage seam, not a schema change.
 */
export interface ReportDraft {
  /** Client-generated, stable for the lifetime of this draft (docs/adr/0005-offline-indexeddb-workbox.md dedupe key). */
  clientReportId: string;
  /** Selected disaster_event id — step 1 of the wizard. */
  eventId: string | null;
  eventName: string | null;
  title: string;
  description: string;
  /** The Reporter's own observed severity — distinct from any later AI/Verifier classification. */
  observedSeverity: SeverityClass | null;
  contactPreference: ContactPreference;
  photo: ReportPhoto | null;
  location: ReportLocation | null;
  consent: ReportConsent;
  /** Wizard progress bookkeeping — which step the user last reached. */
  currentStep: WizardStep;
  status: DraftStatus;
  createdAtClient: string;
  updatedAtClient: string;
}

export type ContactPreference = "telepon" | "email" | "tidak_perlu_dihubungi";

export type LocationSource = "gps" | "manual_pin" | "manual_address";

export interface ReportPhoto {
  /** Object URL or data URL for local preview; BLOCK 13's repository owns real blob storage. */
  previewUrl: string;
  /** The original captured/selected blob, kept in memory for this session's submit path. */
  blob: Blob;
  mimeType: string;
  sizeBytes: number;
  /** Simple heuristic quality signal computed client-side for the Preview step's feedback — not a model score. */
  qualityWarning: QualityWarning | null;
}

export type QualityWarning = "terlalu_gelap" | "kemungkinan_buram" | "resolusi_rendah" | null;

export interface ReportLocation {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  altitudeMeters: number | null;
  headingDegrees: number | null;
  capturedAtClient: string;
  source: LocationSource;
  /** Only populated when source is a manual fallback. */
  manualAddress: string | null;
}

export interface ReportConsent {
  /** Versioned consent strings so a future policy change doesn't silently reinterpret an old acceptance. */
  dataProcessingVersion: string | null;
  accuracyDisclosureVersion: string | null;
  acceptedAtClient: string | null;
}

export const WIZARD_STEPS = [
  "event",
  "photo",
  "preview",
  "gps",
  "manual_location",
  "description",
  "consent",
  "review",
  "submit",
] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

export type DraftStatus = "draft_local" | "queued_offline" | "syncing" | "submitted" | "failed";

export const CURRENT_CONSENT_VERSIONS = {
  dataProcessing: "2026-07-17",
  accuracyDisclosure: "2026-07-17",
} as const;

export function createEmptyDraft(clientReportId: string): ReportDraft {
  const now = new Date().toISOString();
  return {
    clientReportId,
    eventId: null,
    eventName: null,
    title: "",
    description: "",
    observedSeverity: null,
    contactPreference: "tidak_perlu_dihubungi",
    photo: null,
    location: null,
    consent: {
      dataProcessingVersion: null,
      accuracyDisclosureVersion: null,
      acceptedAtClient: null,
    },
    currentStep: "event",
    status: "draft_local",
    createdAtClient: now,
    updatedAtClient: now,
  };
}
