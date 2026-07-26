import "server-only";
import type { ConsentDocumentKey } from "@mboyo/domain";
import { ApiError } from "../api/errors";
import type { CommandDbClient } from "../command/types";

export const CURRENT_CONSENT_VERSIONS: Record<ConsentDocumentKey, string> = {
  privacy_notice: "2026-07-27",
};

export interface ConsentStatusDto {
  documentKey: ConsentDocumentKey;
  currentVersion: string;
  acceptedVersion: string | null;
  acceptedAt: string | null;
  needsConsent: boolean;
}

interface ConsentRecordRow {
  document_key: ConsentDocumentKey;
  version: string;
  accepted_at: string;
}

export async function getConsentStatus(db: CommandDbClient, profileId: string): Promise<ConsentStatusDto[]> {
  try {
    const { data, error } = await db
      .from("consent_records")
      .select("document_key, version, accepted_at")
      .eq("profile_id", profileId)
      .order("accepted_at", { ascending: false })
      .returns<ConsentRecordRow[]>();

    if (!error && data) {
      const latestByDocument = new Map<ConsentDocumentKey, ConsentRecordRow>();
      for (const row of data) {
        if (!latestByDocument.has(row.document_key)) {
          latestByDocument.set(row.document_key, row);
        }
      }

      return (Object.keys(CURRENT_CONSENT_VERSIONS) as ConsentDocumentKey[]).map((documentKey) => {
        const latest = latestByDocument.get(documentKey);
        const currentVersion = CURRENT_CONSENT_VERSIONS[documentKey];
        return {
          documentKey,
          currentVersion,
          acceptedVersion: latest?.version ?? null,
          acceptedAt: latest?.accepted_at ?? null,
          needsConsent: latest?.version !== currentVersion,
        };
      });
    }
  } catch {}

  throw new ApiError("internal_error", "Gagal memuat status persetujuan.");
}

export async function recordConsent(
  db: CommandDbClient,
  documentKey: ConsentDocumentKey,
): Promise<ConsentRecordRow> {
  const version = CURRENT_CONSENT_VERSIONS[documentKey];
  const { data, error } = await db
    .rpc("record_consent", { p_document_key: documentKey, p_version: version })
    .single<ConsentRecordRow>();

  if (error || !data) {
    throw new ApiError("internal_error", "Gagal menyimpan persetujuan.");
  }

  return data;
}
