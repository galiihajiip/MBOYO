import type { Metadata } from "next";
import { EmptyState } from "@mboyo/ui";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { listPendingInformationRequests } from "../../../lib/reports/service/information-requests";
import { InformationRequestList } from "../../../components/verifier/InformationRequestList";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Permintaan Informasi — MBOYO" };

/**
 * Permintaan Informasi (BLOCK 23) — reports awaiting a Verifier's next
 * look after a request_info decision, replacing the earlier stub. See
 * lib/reports/service/information-requests.ts's doc comment for the
 * disclosed scope limitation: there is no separate "response received"
 * signal anywhere in the schema, so this list is exactly "still
 * needs_manual_review with request_info as its latest decision" — tapping
 * an item returns to the report detail to make the final decision, per
 * docs/product/SCREEN_INVENTORY.md.
 */
export default async function PermintaanInformasiPage() {
  const supabase = await createServerSupabaseClient();
  const requests = await listPendingInformationRequests(supabase);

  if (requests.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-sans text-2xl font-bold text-on-surface">Permintaan Informasi</h1>
        <EmptyState title="Tidak ada permintaan informasi tertunda" description="Semua permintaan informasi sudah ditindaklanjuti." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-sans text-2xl font-bold text-on-surface">Permintaan Informasi</h1>
        <p className="mt-1 font-sans text-sm text-on-surface-variant">
          {requests.length} laporan menunggu tanggapan lebih lanjut.
        </p>
      </div>
      <InformationRequestList requests={requests} />
    </div>
  );
}
