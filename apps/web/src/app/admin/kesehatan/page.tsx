import type { Metadata } from "next";
import { StubPage } from "../../../components/shell/StubPage";

export const metadata: Metadata = { title: "Kesehatan Sistem — MBOYO" };

/**
 * Per RBAC_MATRIX.md, this screen exposes analysis_job status/queue-depth
 * (read-only) and model_registry_entry promotion (the one approve action
 * this role retains) — never report validation or task dispatch.
 */
export default function KesehatanSistemPage() {
  return (
    <StubPage
      title="Kesehatan Sistem"
      description="Visibilitas status layanan (kedalaman antrean, registry model) dan aksi promosi model menyusul pada blok implementasi Administrasi."
    />
  );
}
