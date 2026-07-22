-- BLOCK 24 — storage.objects RLS policies for the generated-exports bucket
-- (supabase/config.toml declares it, but like report-evidence before
-- BLOCK 15, no storage.objects policies existed for it yet — without them
-- an RLS-scoped client cannot upload/read objects in this bucket at all).
--
-- Objects are stored at path `{disaster_event_id}/{export_job_id}.{ext}`
-- (see apps/web/src/lib/command/exports.ts), so ownership/role checks key
-- off the export_jobs row matching both the path's job-id segment (file
-- stem, before the extension) and the calling Coordinator's own
-- requested_by_profile_id — mirroring export_jobs' own RLS
-- (export_jobs_coordinator_select_own et al., BLOCK 08's rls_policies
-- migration) so the storage object and its metadata row never diverge in
-- who can access them.

create policy generated_exports_bucket_coordinator_all on storage.objects
  for all
  using (
    bucket_id = 'generated-exports'
    and public.has_role('response_coordinator')
    and exists (
      select 1
      from public.export_jobs ej
      join public.profiles p on p.id = ej.requested_by_profile_id
      where p.user_id = auth.uid()
        and ej.storage_path = name
    )
  )
  with check (
    bucket_id = 'generated-exports'
    and public.has_role('response_coordinator')
    and exists (
      select 1
      from public.export_jobs ej
      join public.profiles p on p.id = ej.requested_by_profile_id
      where p.user_id = auth.uid()
        and ej.storage_path = name
    )
  );

create policy generated_exports_bucket_auditor_select on storage.objects
  for select
  using (
    bucket_id = 'generated-exports'
    and public.has_role('auditor')
  );

comment on policy generated_exports_bucket_coordinator_all on storage.objects is
  'Coordinator may read/write an export object only once its export_jobs row (storage_path = this object''s name) is owned by them — matches export_jobs_coordinator_select_own.';
comment on policy generated_exports_bucket_auditor_select on storage.objects is
  'Auditor may read any export object, matching export_jobs_auditor_all_read (org-wide compliance visibility).';
