-- BLOCK 29 — behavioral tests for the Coordinator command-center RPCs
-- (incident_clusters/response_tasks lifecycle), notification creation, and
-- disaster_event management RPCs. Complements 060_rpc_behavior.sql; split
-- into a second file purely for size, not for any dependency reason.

begin;
select plan(27);

create temporary table t_ids as
select
  (select user_id from public.profiles where display_name like 'Siti Aminah%') as reporter_user_id,
  (select id from public.profiles where display_name like 'Siti Aminah%') as reporter_profile_id,
  (select user_id from public.profiles where display_name like 'Budi Raharjo%') as verifier_user_id,
  (select id from public.profiles where display_name like 'Budi Raharjo%') as verifier_profile_id,
  (select user_id from public.profiles where display_name like 'Dewi Lestari%') as coordinator_user_id,
  (select id from public.profiles where display_name like 'Dewi Lestari%') as coordinator_profile_id,
  (select user_id from public.profiles where display_name like 'Agus Santoso%') as admin_user_id,
  (select id from public.profiles where display_name like 'Agus Santoso%') as admin_profile_id,
  (select id from public.organizations limit 1) as org_id,
  (select id from public.disaster_events limit 1) as event_id,
  (select id from public.reports where status = 'verified' limit 1) as verified_report_id,
  (select id from public.reports where status = 'draft_local' limit 1) as draft_report_id;

-- ============================================================================
-- create_incident_cluster() / add_reports_to_cluster()
-- ============================================================================

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select coordinator_user_id::text from t_ids))::text, true);

-- A second verified report to cluster alongside the seeded one, so
-- create_incident_cluster has two distinct report_ids to work with.
create temporary table t_second_verified as
insert into public.reports (client_report_id, reporter_profile_id, disaster_event_id, status, submitted_at)
values (gen_random_uuid(), (select reporter_profile_id from t_ids), (select event_id from t_ids), 'verified', now())
returning id;

create temporary table t_cluster as
select (
  public.create_incident_cluster(
    (select event_id from t_ids),
    'Klaster Uji BLOCK 29',
    array[(select verified_report_id from t_ids), (select id from t_second_verified)]
  )
).id as cluster_id;

select ok(
  (select count(*) from public.incident_clusters where id = (select cluster_id from t_cluster)) = 1,
  'create_incident_cluster() creates a cluster row'
);

select ok(
  (select count(*) from public.cluster_members where incident_cluster_id = (select cluster_id from t_cluster)) = 2,
  'create_incident_cluster() adds every named report as a cluster_member'
);

select throws_ok(
  format(
    $$ select public.create_incident_cluster(%L, 'Duplikat', array[%L]) $$,
    (select event_id from t_ids), (select verified_report_id from t_ids)
  ),
  null,
  null,
  'create_incident_cluster() rejects a report already in another cluster'
);

select throws_ok(
  format(
    $$ select public.create_incident_cluster(%L, 'Draf', array[%L]) $$,
    (select event_id from t_ids), (select draft_report_id from t_ids)
  ),
  null,
  null,
  'create_incident_cluster() rejects a non-verified report'
);

create temporary table t_third_verified as
insert into public.reports (client_report_id, reporter_profile_id, disaster_event_id, status, submitted_at)
values (gen_random_uuid(), (select reporter_profile_id from t_ids), (select event_id from t_ids), 'verified', now())
returning id;

select lives_ok(
  format(
    $$ select public.add_reports_to_cluster(%L, array[%L]) $$,
    (select cluster_id from t_cluster), (select id from t_third_verified)
  ),
  'add_reports_to_cluster() extends an existing cluster with a new verified report'
);

select ok(
  (select count(*) from public.cluster_members where incident_cluster_id = (select cluster_id from t_cluster)) = 3,
  'the cluster now has 3 members after add_reports_to_cluster()'
);

select ok(
  exists (
    select 1 from public.audit_events
    where entity_type = 'incident_cluster' and action = 'incident_cluster.created' and entity_id = (select cluster_id from t_cluster)
  ),
  'an incident_cluster.created audit_event was appended'
);

-- ============================================================================
-- create_response_task() / assign_response_task()
-- ============================================================================

create temporary table t_task as
select (
  public.create_response_task(
    (select verified_report_id from t_ids), null, 'Evakuasi', 'Uji coba BLOCK 29', null, 'high', null
  )
).id as task_id;

select ok(
  (select status from public.response_tasks where id = (select task_id from t_task)) = 'draft',
  'create_response_task() creates a task in draft status'
);

select throws_ok(
  format(
    $$ select public.create_response_task(%L, %L, 'x', 'y') $$,
    (select verified_report_id from t_ids), (select cluster_id from t_cluster)
  ),
  null,
  null,
  'create_response_task() rejects specifying both report_id and incident_cluster_id'
);

select throws_ok(
  $$ select public.create_response_task(null, null, 'x', 'y') $$,
  null,
  null,
  'create_response_task() rejects specifying neither report_id nor incident_cluster_id'
);

select throws_ok(
  format(
    $$ select public.create_response_task(%L, null, 'x', 'y', null, 'critical') $$,
    (select verified_report_id from t_ids)
  ),
  null,
  null,
  'create_response_task() rejects critical priority at creation time'
);

select lives_ok(
  format(
    $$ select public.assign_response_task(%L, %L) $$,
    (select task_id from t_task), (select verifier_profile_id from t_ids)
  ),
  'assign_response_task() assigns a profile to a draft task'
);

select ok(
  (select status from public.response_tasks where id = (select task_id from t_task)) = 'assigned',
  'assign_response_task() advances the task to assigned'
);

select ok(
  (
    select count(*) from public.task_assignments
    where response_task_id = (select task_id from t_task)
      and assignee_profile_id = (select verifier_profile_id from t_ids)
      and unassigned_at is null
  ) = 1,
  'assign_response_task() creates an active task_assignments row for the named assignee'
);

-- Reassignment: closes the prior assignment and opens a new one.
select lives_ok(
  format(
    $$ select public.assign_response_task(%L, %L) $$,
    (select task_id from t_task), (select coordinator_profile_id from t_ids)
  ),
  'assign_response_task() allows reassigning an already-assigned task to a different profile'
);

select ok(
  (
    select count(*) from public.task_assignments
    where response_task_id = (select task_id from t_task) and unassigned_at is null
  ) = 1,
  'reassignment leaves exactly one active task_assignments row (the prior one was closed out)'
);

select ok(
  (
    select assignee_profile_id from public.task_assignments
    where response_task_id = (select task_id from t_task) and unassigned_at is null
  ) = (select coordinator_profile_id from t_ids),
  'the active assignment now points at the newly assigned profile'
);

reset role;

-- ============================================================================
-- create_notification() / mark_notification_read()
-- ============================================================================

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select admin_user_id::text from t_ids))::text, true);

select lives_ok(
  format(
    $$ select public.create_notification(%L, array['verifier']::public.app_role[], 'test_notification', 'info', '{}'::jsonb, 'block29-test-dedup-key') $$,
    (select org_id from t_ids)
  ),
  'create_notification() fans out a notification to every profile holding one of the named roles'
);

select ok(
  (select count(*) from public.notifications where dedup_key = 'block29-test-dedup-key') >= 1,
  'create_notification() inserted at least one notification row for the fan-out'
);

select throws_ok(
  format(
    $$ select public.create_notification(%L, array['verifier']::public.app_role[], 'test_notification', 'not_a_real_level', '{}'::jsonb) $$,
    (select org_id from t_ids)
  ),
  null,
  null,
  'create_notification() rejects an invalid level'
);

reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select verifier_user_id::text from t_ids))::text, true);

select lives_ok(
  format(
    $$ select public.mark_notification_read(
         (select id from public.notifications where dedup_key = 'block29-test-dedup-key' and recipient_profile_id = %L limit 1)
       ) $$,
    (select verifier_profile_id from t_ids)
  ),
  'the recipient Verifier can mark their own notification read'
);

select ok(
  (
    select read_at is not null from public.notifications
    where dedup_key = 'block29-test-dedup-key' and recipient_profile_id = (select verifier_profile_id from t_ids)
  ),
  'mark_notification_read() actually set read_at'
);

reset role;

-- ============================================================================
-- create_disaster_event() / update_disaster_event()
-- ============================================================================

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select admin_user_id::text from t_ids))::text, true);

create temporary table t_event as
select (public.create_disaster_event('Kejadian Uji BLOCK 29')).id as event_id;

select ok(
  (select status from public.disaster_events where id = (select event_id from t_event)) = 'active',
  'create_disaster_event() creates an active disaster_event by default'
);

select lives_ok(
  format(
    $$ select public.update_disaster_event(%L, null, 'closed') $$,
    (select event_id from t_event)
  ),
  'update_disaster_event() can transition an event''s status'
);

select ok(
  (select status from public.disaster_events where id = (select event_id from t_event)) = 'closed',
  'update_disaster_event() actually persisted the new status'
);

select throws_ok(
  $$ select public.create_disaster_event('') $$,
  null,
  null,
  'create_disaster_event() rejects an empty name'
);

reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select coordinator_user_id::text from t_ids))::text, true);

select throws_ok(
  $$ select public.create_disaster_event('Should Not Be Allowed') $$,
  null,
  null,
  'create_disaster_event() rejects a caller who is not system_administrator'
);

reset role;

select * from finish();
rollback;
