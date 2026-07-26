-- ============================================================================
-- storage.objects RLS policies for the report-evidence bucket (BLOCK 15)
-- ============================================================================
-- The report-evidence bucket (supabase/config.toml, private, signed-URL-only)
-- had no storage.objects RLS policies at all until this migration — every
-- other table's RLS was added in BLOCK 08, but storage.objects (a
-- Supabase-managed table, not one of ours) was overlooked. Without these
-- policies, an RLS-scoped client (anon key + user session, the client every
-- ordinary route uses per docs/adr/0002-supabase-platform.md) cannot upload
-- or read objects in this bucket at all — insert/select against
-- storage.objects is denied by default once RLS is enabled on it (which
-- Supabase enables by default for the storage schema).
--
-- Objects are stored at path `{report_id}/{sha256_hash}` (see
-- apps/web/src/app/api/reports/evidence/route.ts and its thumbnail sibling
-- at `{report_id}/thumb-{sha256_hash}`), so ownership/role checks key off
-- the report_id path segment via storage.foldername(name), reusing the same
-- public.owns_report()/public.has_role() helpers BLOCK 08 already built for
-- the report_evidence table — deliberately the same authorization shape as
-- report_evidence's own RLS policies (BLOCK 08's rls_policies migration),
-- since the storage object and its metadata row must never diverge in who
-- can access them.

create policy report_evidence_bucket_reporter_insert_own on storage.objects
  for insert
  with check (
    bucket_id = 'report-evidence'
    and public.owns_report((storage.foldername(name))[1]::uuid)
  );

create policy report_evidence_bucket_reporter_select_own on storage.objects
  for select
  using (
    bucket_id = 'report-evidence'
    and public.owns_report((storage.foldername(name))[1]::uuid)
  );

create policy report_evidence_bucket_verifier_select on storage.objects
  for select
  using (
    bucket_id = 'report-evidence'
    and public.has_role('verifier')
  );

create policy report_evidence_bucket_coordinator_select_verified on storage.objects
  for select
  using (
    bucket_id = 'report-evidence'
    and public.has_role('response_coordinator')
    and exists (
      select 1 from public.reports r
      where r.id = (storage.foldername(name))[1]::uuid and r.status = 'verified'
    )
  );

create policy report_evidence_bucket_auditor_select on storage.objects
  for select
  using (
    bucket_id = 'report-evidence'
    and public.has_role('auditor')
  );

-- No update/delete policy for any role — evidence objects are immutable
-- after upload, matching report_evidence table's own immutable-after-insert
-- posture (BLOCK 08's rls_policies migration comment). A re-upload for the
-- same report+hash uses `upsert: true` at the application layer (see the
-- evidence route), which Supabase Storage implements as insert-with-
-- overwrite under the same insert policy above, not a separate update path.

-- `comment on policy ... on storage.objects` statements were removed here:
-- Supabase Cloud's migration role doesn't own storage.objects (it's owned
-- by supabase_storage_admin), so COMMENT ON POLICY fails with "must be
-- owner of relation objects". These were documentation-only (no RLS/access
-- effect) — see the policy definitions above for the same information.
-- report_evidence_bucket_reporter_insert_own: Reporter may upload evidence
--   only under the path prefix of a report they own — path segment 1 is
--   the report_id.
-- report_evidence_bucket_verifier_select: Verifier may read any evidence
--   object in this bucket, matching report_evidence table SELECT policy.
-- report_evidence_bucket_coordinator_select_verified: Coordinator may read
--   evidence only for reports already verified, matching report_evidence
--   table SELECT policy.
