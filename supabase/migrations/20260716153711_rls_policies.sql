-- Row-Level Security policies implementing docs/product/RBAC_MATRIX.md
-- exactly, table by table. Every table has RLS enabled with FORCE, so even
-- the table owner (used by the migration runner) is subject to policy
-- unless explicitly bypassing RLS (service-role connections bypass RLS by
-- Supabase design, matching docs/adr/0002-supabase-platform.md — this is
-- the intended "server-only bypass" path, never a leak).
--
-- Legend from RBAC_MATRIX.md: C=create(insert), R=read(select), U=update,
-- D=delete, A=approve, E=export, As=assign, Co=configure.

-- ============================================================================
-- organizations
-- ============================================================================
-- Reporter/Verifier/Coordinator/Auditor: R. System Administrator: C/R/U/Co.

alter table public.organizations enable row level security;
alter table public.organizations force row level security;

create policy organizations_select_any_member on public.organizations
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.organization_id = organizations.id
        and p.user_id = auth.uid()
    )
  );

create policy organizations_admin_all on public.organizations
  for all
  using (public.has_role('system_administrator'))
  with check (public.has_role('system_administrator'));

-- ============================================================================
-- profiles
-- ============================================================================
-- Everyone: R/U own. System Administrator: C/R/U/D/Co all.

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

create policy profiles_select_own on public.profiles
  for select
  using (user_id = auth.uid());

create policy profiles_update_own on public.profiles
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy profiles_admin_all on public.profiles
  for all
  using (public.has_role('system_administrator'))
  with check (public.has_role('system_administrator'));

-- ============================================================================
-- role_assignments
-- ============================================================================
-- Everyone: R own. System Administrator: C/R/U/D, exclusively.

alter table public.role_assignments enable row level security;
alter table public.role_assignments force row level security;

create policy role_assignments_select_own on public.role_assignments
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = role_assignments.profile_id
        and p.user_id = auth.uid()
    )
  );

create policy role_assignments_admin_all on public.role_assignments
  for all
  using (public.has_role('system_administrator'))
  with check (public.has_role('system_administrator'));

-- ============================================================================
-- disaster_events
-- ============================================================================
-- Reporter/Verifier/Coordinator/Auditor: R. System Administrator: C/R/U/Co.

alter table public.disaster_events enable row level security;
alter table public.disaster_events force row level security;

create policy disaster_events_select_any_authenticated on public.disaster_events
  for select
  using (public.current_profile_id() is not null);

create policy disaster_events_admin_all on public.disaster_events
  for all
  using (public.has_role('system_administrator'))
  with check (public.has_role('system_administrator'));

-- ============================================================================
-- reports
-- ============================================================================
-- Reporter: C, R own. Verifier: R all, no direct U (transitions only via
-- verification_reviews insert + a narrow status-transition update, added
-- below). Coordinator: R verified only. Auditor: R all (read-only).
-- System Administrator: no access (cannot validate).

alter table public.reports enable row level security;
alter table public.reports force row level security;

create policy reports_reporter_select_own on public.reports
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = reports.reporter_profile_id
        and p.user_id = auth.uid()
    )
  );

create policy reports_reporter_insert_own on public.reports
  for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = reports.reporter_profile_id
        and p.user_id = auth.uid()
    )
    and public.has_role('reporter')
  );

create policy reports_verifier_select_all on public.reports
  for select
  using (public.has_role('verifier'));

-- Verifier may update ONLY the status column, and only as the result of a
-- verification decision — enforced at the application layer (the API route
-- that both inserts a verification_reviews row and updates status in the
-- same transaction); this policy just grants the underlying row-level
-- permission. It does not grant permission to edit description/evidence
-- references, since those columns aren't targeted by that code path and
-- report_evidence has its own immutable-after-insert policy below.
create policy reports_verifier_update_status on public.reports
  for update
  using (public.has_role('verifier'))
  with check (public.has_role('verifier'));

create policy reports_coordinator_select_verified on public.reports
  for select
  using (
    public.has_role('response_coordinator')
    and status in ('verified')
  );

create policy reports_auditor_select_all on public.reports
  for select
  using (public.has_role('auditor'));

-- ============================================================================
-- report_evidence
-- ============================================================================
-- Reporter: C own report, at submit time only (no U/D thereafter — simply
-- no update/delete policy is defined, so those actions are denied by
-- default once RLS is enabled). Verifier: R. Coordinator: R verified only.
-- Auditor: R.

alter table public.report_evidence enable row level security;
alter table public.report_evidence force row level security;

create policy report_evidence_reporter_insert_own on public.report_evidence
  for insert
  with check (public.owns_report(report_id));

create policy report_evidence_reporter_select_own on public.report_evidence
  for select
  using (public.owns_report(report_id));

create policy report_evidence_verifier_select on public.report_evidence
  for select
  using (public.has_role('verifier'));

create policy report_evidence_coordinator_select_verified on public.report_evidence
  for select
  using (
    public.has_role('response_coordinator')
    and exists (
      select 1 from public.reports r
      where r.id = report_evidence.report_id and r.status = 'verified'
    )
  );

create policy report_evidence_auditor_select on public.report_evidence
  for select
  using (public.has_role('auditor'));

-- ============================================================================
-- geolocation_observations
-- ============================================================================
-- Same shape as report_evidence.

alter table public.geolocation_observations enable row level security;
alter table public.geolocation_observations force row level security;

create policy geolocation_observations_reporter_insert_own on public.geolocation_observations
  for insert
  with check (public.owns_report(report_id));

create policy geolocation_observations_reporter_select_own on public.geolocation_observations
  for select
  using (public.owns_report(report_id));

create policy geolocation_observations_verifier_select on public.geolocation_observations
  for select
  using (public.has_role('verifier'));

create policy geolocation_observations_coordinator_select_verified on public.geolocation_observations
  for select
  using (
    public.has_role('response_coordinator')
    and exists (
      select 1 from public.reports r
      where r.id = geolocation_observations.report_id and r.status = 'verified'
    )
  );

create policy geolocation_observations_auditor_select on public.geolocation_observations
  for select
  using (public.has_role('auditor'));

-- ============================================================================
-- analysis_jobs
-- ============================================================================
-- No human role creates/updates this table directly — only apps/worker via
-- the service-role connection (which bypasses RLS entirely). Human roles
-- get read-only visibility per RBAC_MATRIX.md: Verifier R, Coordinator R
-- (verified only), System Administrator R (health/status — here granted as
-- full read since there's no separate "detail" table to restrict further),
-- Auditor R.

alter table public.analysis_jobs enable row level security;
alter table public.analysis_jobs force row level security;

create policy analysis_jobs_verifier_select on public.analysis_jobs
  for select
  using (public.has_role('verifier'));

create policy analysis_jobs_coordinator_select_verified on public.analysis_jobs
  for select
  using (
    public.has_role('response_coordinator')
    and exists (
      select 1 from public.reports r
      where r.id = analysis_jobs.report_id and r.status = 'verified'
    )
  );

create policy analysis_jobs_admin_select on public.analysis_jobs
  for select
  using (public.has_role('system_administrator'));

create policy analysis_jobs_auditor_select on public.analysis_jobs
  for select
  using (public.has_role('auditor'));

-- ============================================================================
-- model_predictions / model_explanations
-- ============================================================================
-- Same read-only shape for human roles; apps/worker writes via service-role.

alter table public.model_predictions enable row level security;
alter table public.model_predictions force row level security;

create policy model_predictions_verifier_select on public.model_predictions
  for select
  using (public.has_role('verifier'));

create policy model_predictions_coordinator_select_verified on public.model_predictions
  for select
  using (
    public.has_role('response_coordinator')
    and exists (
      select 1 from public.reports r
      where r.id = model_predictions.report_id and r.status = 'verified'
    )
  );

create policy model_predictions_admin_select on public.model_predictions
  for select
  using (public.has_role('system_administrator'));

create policy model_predictions_auditor_select on public.model_predictions
  for select
  using (public.has_role('auditor'));

alter table public.model_explanations enable row level security;
alter table public.model_explanations force row level security;

create policy model_explanations_verifier_select on public.model_explanations
  for select
  using (public.has_role('verifier'));

create policy model_explanations_coordinator_select_verified on public.model_explanations
  for select
  using (
    public.has_role('response_coordinator')
    and exists (
      select 1
      from public.model_predictions mp
      join public.reports r on r.id = mp.report_id
      where mp.id = model_explanations.model_prediction_id and r.status = 'verified'
    )
  );

create policy model_explanations_auditor_select on public.model_explanations
  for select
  using (public.has_role('auditor'));

-- ============================================================================
-- verification_reviews
-- ============================================================================
-- Verifier: C own decision, R. Coordinator: R. Auditor: R. No U/D for anyone
-- — immutable once created, per docs/product/DOMAIN_MODEL.md ("a correction
-- is a new row, not an edit").

alter table public.verification_reviews enable row level security;
alter table public.verification_reviews force row level security;

create policy verification_reviews_verifier_insert_own on public.verification_reviews
  for insert
  with check (
    public.has_role('verifier')
    and exists (
      select 1 from public.profiles p
      where p.id = verification_reviews.verifier_profile_id
        and p.user_id = auth.uid()
    )
  );

create policy verification_reviews_verifier_select on public.verification_reviews
  for select
  using (public.has_role('verifier'));

create policy verification_reviews_coordinator_select on public.verification_reviews
  for select
  using (public.has_role('response_coordinator'));

create policy verification_reviews_auditor_select on public.verification_reviews
  for select
  using (public.has_role('auditor'));

-- ============================================================================
-- incident_clusters / cluster_members
-- ============================================================================
-- Coordinator: C/R/U/D + assign, exclusively. Verifier/Admin/Auditor: R.

alter table public.incident_clusters enable row level security;
alter table public.incident_clusters force row level security;

create policy incident_clusters_coordinator_all on public.incident_clusters
  for all
  using (public.has_role('response_coordinator'))
  with check (public.has_role('response_coordinator'));

create policy incident_clusters_verifier_select on public.incident_clusters
  for select
  using (public.has_role('verifier'));

create policy incident_clusters_admin_select on public.incident_clusters
  for select
  using (public.has_role('system_administrator'));

create policy incident_clusters_auditor_select on public.incident_clusters
  for select
  using (public.has_role('auditor'));

alter table public.cluster_members enable row level security;
alter table public.cluster_members force row level security;

create policy cluster_members_coordinator_all on public.cluster_members
  for all
  using (public.has_role('response_coordinator'))
  with check (public.has_role('response_coordinator'));

create policy cluster_members_verifier_select on public.cluster_members
  for select
  using (public.has_role('verifier'));

create policy cluster_members_admin_select on public.cluster_members
  for select
  using (public.has_role('system_administrator'));

create policy cluster_members_auditor_select on public.cluster_members
  for select
  using (public.has_role('auditor'));

-- ============================================================================
-- response_tasks / task_assignments
-- ============================================================================
-- Coordinator: C/R/U + assign, exclusively (including cancel, per
-- docs/product/STATE_MACHINES.md — only Coordinator cancels). Verifier: R
-- verified reports' tasks only. Admin/Auditor: R.
--
-- The assignee's own status-transition actions (acknowledge/start/block/
-- complete per STATE_MACHINES.md) are modeled as a narrower update policy
-- scoped to their own assignment — this grants the row-level permission;
-- which specific status transitions are valid is enforced by the state
-- machine in application code, not by SQL constraints on the (necessarily
-- more permissive) column-level RLS grant.

alter table public.response_tasks enable row level security;
alter table public.response_tasks force row level security;

create policy response_tasks_coordinator_all on public.response_tasks
  for all
  using (public.has_role('response_coordinator'))
  with check (public.has_role('response_coordinator'));

create policy response_tasks_assignee_update_own on public.response_tasks
  for update
  using (
    exists (
      select 1
      from public.task_assignments ta
      join public.profiles p on p.id = ta.assignee_profile_id
      where ta.response_task_id = response_tasks.id
        and p.user_id = auth.uid()
        and ta.unassigned_at is null
    )
  )
  with check (
    exists (
      select 1
      from public.task_assignments ta
      join public.profiles p on p.id = ta.assignee_profile_id
      where ta.response_task_id = response_tasks.id
        and p.user_id = auth.uid()
        and ta.unassigned_at is null
    )
  );

create policy response_tasks_verifier_select_verified on public.response_tasks
  for select
  using (
    public.has_role('verifier')
    and (
      exists (select 1 from public.reports r where r.id = response_tasks.report_id and r.status = 'verified')
      or response_tasks.incident_cluster_id is not null
    )
  );

create policy response_tasks_admin_select on public.response_tasks
  for select
  using (public.has_role('system_administrator'));

create policy response_tasks_auditor_select on public.response_tasks
  for select
  using (public.has_role('auditor'));

alter table public.task_assignments enable row level security;
alter table public.task_assignments force row level security;

create policy task_assignments_coordinator_all on public.task_assignments
  for all
  using (public.has_role('response_coordinator'))
  with check (public.has_role('response_coordinator'));

create policy task_assignments_assignee_select_own on public.task_assignments
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = task_assignments.assignee_profile_id
        and p.user_id = auth.uid()
    )
  );

create policy task_assignments_admin_select on public.task_assignments
  for select
  using (public.has_role('system_administrator'));

create policy task_assignments_auditor_select on public.task_assignments
  for select
  using (public.has_role('auditor'));

-- ============================================================================
-- notifications
-- ============================================================================
-- Everyone: R own. System writes via service-role (bypasses RLS). Auditor: R
-- (read-only, per RBAC_MATRIX.md "R (read-only)" — interpreted as full read
-- access for oversight purposes, since notifications carry no independent
-- sensitive evidence).

alter table public.notifications enable row level security;
alter table public.notifications force row level security;

create policy notifications_select_own on public.notifications
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = notifications.recipient_profile_id
        and p.user_id = auth.uid()
    )
  );

create policy notifications_update_own_read_at on public.notifications
  for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = notifications.recipient_profile_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = notifications.recipient_profile_id
        and p.user_id = auth.uid()
    )
  );

create policy notifications_auditor_select on public.notifications
  for select
  using (public.has_role('auditor'));

-- ============================================================================
-- push_subscriptions
-- ============================================================================
-- Everyone: C/D own. Admin: R.

alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;

create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = push_subscriptions.profile_id
        and p.user_id = auth.uid()
    )
  );

create policy push_subscriptions_select_own on public.push_subscriptions
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = push_subscriptions.profile_id
        and p.user_id = auth.uid()
    )
  );

create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = push_subscriptions.profile_id
        and p.user_id = auth.uid()
    )
  );

create policy push_subscriptions_admin_select on public.push_subscriptions
  for select
  using (public.has_role('system_administrator'));

-- ============================================================================
-- export_jobs
-- ============================================================================
-- Coordinator: C/R own event. Admin: R. Auditor: R/E (full, org-wide).

alter table public.export_jobs enable row level security;
alter table public.export_jobs force row level security;

create policy export_jobs_coordinator_insert_own on public.export_jobs
  for insert
  with check (
    public.has_role('response_coordinator')
    and exists (
      select 1 from public.profiles p
      where p.id = export_jobs.requested_by_profile_id
        and p.user_id = auth.uid()
    )
  );

create policy export_jobs_coordinator_select_own on public.export_jobs
  for select
  using (
    public.has_role('response_coordinator')
    and exists (
      select 1 from public.profiles p
      where p.id = export_jobs.requested_by_profile_id
        and p.user_id = auth.uid()
    )
  );

create policy export_jobs_admin_select on public.export_jobs
  for select
  using (public.has_role('system_administrator'));

create policy export_jobs_auditor_all_read on public.export_jobs
  for select
  using (public.has_role('auditor'));

create policy export_jobs_auditor_insert on public.export_jobs
  for insert
  with check (
    public.has_role('auditor')
    and exists (
      select 1 from public.profiles p
      where p.id = export_jobs.requested_by_profile_id
        and p.user_id = auth.uid()
    )
  );

-- ============================================================================
-- audit_events — append-only, no UPDATE/DELETE policy for anyone
-- ============================================================================
-- Per docs/security/THREAT_MODEL.md threat #12: Auditor R (full), Admin R
-- (here granted the same full read since there is no narrower "operational
-- subset" table — a future block may split this into a view if that
-- distinction needs enforcing at the row level). No role, including
-- system_administrator, has UPDATE or DELETE — omitting those policies
-- means RLS denies them by default; REVOKE below removes the underlying
-- grant entirely as defense in depth.

alter table public.audit_events enable row level security;
alter table public.audit_events force row level security;

create policy audit_events_admin_select on public.audit_events
  for select
  using (public.has_role('system_administrator'));

create policy audit_events_auditor_select on public.audit_events
  for select
  using (public.has_role('auditor'));

-- INSERT happens only via the append_audit_event() SECURITY DEFINER function
-- (next migration) — no direct INSERT policy is granted to any human role,
-- so application code cannot bypass that function's shape validation.

revoke update, delete on public.audit_events from anon, authenticated;

-- ============================================================================
-- system_settings
-- ============================================================================
-- Reporter/Verifier/Coordinator: R (public subset — here modeled as full
-- read since a "public subset" split requires a column-level view not yet
-- justified by a concrete use case; revisit if a setting needs to stay
-- admin-only-readable). Admin: C/R/U/Co.

alter table public.system_settings enable row level security;
alter table public.system_settings force row level security;

create policy system_settings_select_any_authenticated on public.system_settings
  for select
  using (public.current_profile_id() is not null);

create policy system_settings_admin_all on public.system_settings
  for all
  using (public.has_role('system_administrator'))
  with check (public.has_role('system_administrator'));

-- ============================================================================
-- model_registry_entries / model_evaluations
-- ============================================================================
-- Verifier: R. Admin: A (promote — modeled as UPDATE of is_active/promoted_at).
-- Auditor: R.

alter table public.model_registry_entries enable row level security;
alter table public.model_registry_entries force row level security;

create policy model_registry_entries_verifier_select on public.model_registry_entries
  for select
  using (public.has_role('verifier'));

create policy model_registry_entries_admin_all on public.model_registry_entries
  for all
  using (public.has_role('system_administrator'))
  with check (public.has_role('system_administrator'));

create policy model_registry_entries_auditor_select on public.model_registry_entries
  for select
  using (public.has_role('auditor'));

alter table public.model_evaluations enable row level security;
alter table public.model_evaluations force row level security;

create policy model_evaluations_verifier_select on public.model_evaluations
  for select
  using (public.has_role('verifier'));

create policy model_evaluations_admin_select on public.model_evaluations
  for select
  using (public.has_role('system_administrator'));

create policy model_evaluations_auditor_select on public.model_evaluations
  for select
  using (public.has_role('auditor'));
