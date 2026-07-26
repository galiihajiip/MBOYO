-- BLOCK 26 — System Administrator needs read (SELECT/list) access to both
-- buckets for the Kesehatan Sistem "storage usage" summary — neither
-- report-evidence nor generated-exports had an Admin SELECT policy before
-- this block (BLOCK 15/24 granted Verifier/Coordinator/Auditor access, not
-- Admin, since Admin had no storage-facing screen yet). RBAC_MATRIX.md's
-- System Administrator already has broad read/configuration access
-- generally; this extends that same posture to object listing/metadata,
-- never granting write.

create policy report_evidence_bucket_admin_select on storage.objects
  for select
  using (
    bucket_id = 'report-evidence'
    and public.has_role('system_administrator')
  );

create policy generated_exports_bucket_admin_select on storage.objects
  for select
  using (
    bucket_id = 'generated-exports'
    and public.has_role('system_administrator')
  );

-- `comment on policy ... on storage.objects` statements were removed here:
-- Supabase Cloud's migration role doesn't own storage.objects (it's owned
-- by supabase_storage_admin), so COMMENT ON POLICY fails with "must be
-- owner of relation objects". These were documentation-only (no RLS/access
-- effect) — see the policy definitions above for the same information.
-- report_evidence_bucket_admin_select: System Administrator may read
--   (list/inspect metadata for) evidence objects for storage-usage
--   reporting only — Admin cannot validate/dispatch per AGENTS.md, and
--   this policy grants no write.
-- generated_exports_bucket_admin_select: System Administrator may read
--   (list/inspect metadata for) export objects for storage-usage
--   reporting only.
