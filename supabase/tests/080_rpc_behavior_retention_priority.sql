-- BLOCK 29 — behavioral tests for the retention placeholder RPCs
-- (review_deletion_request, place_legal_hold, release_legal_hold) and the
-- priority-setting RPCs (set_response_task_priority,
-- set_incident_cluster_priority), none of which had a behavioral test
-- beyond incidental RLS-boundary exercise before this block.

begin;
select plan(17);

create temporary table t_ids as
select
  (select user_id from public.profiles where display_name like 'Siti Aminah%') as reporter_user_id,
  (select id from public.profiles where display_name like 'Siti Aminah%') as reporter_profile_id,
  (select user_id from public.profiles where display_name like 'Dewi Lestari%') as coordinator_user_id,
  (select user_id from public.profiles where display_name like 'Agus Santoso%') as admin_user_id,
  (select id from public.disaster_events limit 1) as event_id,
  (select id from public.reports where status = 'verified' limit 1) as verified_report_id,
  (select id from public.response_tasks limit 1) as seeded_task_id;

-- ============================================================================
-- review_deletion_request()
-- ============================================================================

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select reporter_user_id::text from t_ids))::text, true);

create temporary table t_deletion_request as
insert into public.deletion_requests (requested_by_profile_id, subject_report_id, reason)
values ((select reporter_profile_id from t_ids), (select verified_report_id from t_ids), 'Uji coba BLOCK 29')
returning id;

reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select admin_user_id::text from t_ids))::text, true);

select lives_ok(
  format(
    $$ select public.review_deletion_request(%L, 'approved', 'Disetujui untuk pengujian') $$,
    (select id from t_deletion_request)
  ),
  'System Administrator can approve a pending deletion_request'
);

select ok(
  (select status from public.deletion_requests where id = (select id from t_deletion_request)) = 'approved',
  'review_deletion_request() persisted the new status'
);

select ok(
  (select reviewed_at from public.deletion_requests where id = (select id from t_deletion_request)) is not null,
  'review_deletion_request() set reviewed_at'
);

select throws_ok(
  format(
    $$ select public.review_deletion_request(%L, 'pending') $$,
    (select id from t_deletion_request)
  ),
  null,
  null,
  'review_deletion_request() rejects transitioning a request back to pending'
);

select ok(
  exists (
    select 1 from public.audit_events
    where entity_type = 'deletion_request' and action = 'deletion_request.approved'
  ),
  'a deletion_request.approved audit_event was appended'
);

reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select coordinator_user_id::text from t_ids))::text, true);

select throws_ok(
  format(
    $$ select public.review_deletion_request(%L, 'denied') $$,
    (select id from t_deletion_request)
  ),
  null,
  null,
  'review_deletion_request() rejects a caller who is not system_administrator'
);

reset role;

-- ============================================================================
-- place_legal_hold() / release_legal_hold()
-- ============================================================================

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select admin_user_id::text from t_ids))::text, true);

create temporary table t_hold as
select (
  public.place_legal_hold('Penahanan uji BLOCK 29', (select verified_report_id from t_ids), null)
).id as hold_id;

select ok(
  (select released_at from public.legal_holds where id = (select hold_id from t_hold)) is null,
  'place_legal_hold() creates an active (unreleased) hold'
);

select throws_ok(
  format(
    $$ select public.place_legal_hold('Duplikat', %L, null) $$,
    (select verified_report_id from t_ids)
  ),
  null,
  null,
  'placing a second active legal_hold on the same report is rejected (unique active-hold index)'
);

select throws_ok(
  format(
    $$ select public.place_legal_hold('Keduanya', %L, %L) $$,
    (select verified_report_id from t_ids), (select event_id from t_ids)
  ),
  null,
  null,
  'place_legal_hold() rejects specifying both report_id and disaster_event_id'
);

select lives_ok(
  format(
    $$ select public.release_legal_hold(%L) $$,
    (select hold_id from t_hold)
  ),
  'release_legal_hold() releases an active hold'
);

select ok(
  (select released_at from public.legal_holds where id = (select hold_id from t_hold)) is not null,
  'release_legal_hold() persisted released_at'
);

select throws_ok(
  format(
    $$ select public.release_legal_hold(%L) $$,
    (select hold_id from t_hold)
  ),
  null,
  null,
  'release_legal_hold() rejects releasing an already-released hold'
);

reset role;

-- ============================================================================
-- set_response_task_priority() / set_incident_cluster_priority()
-- ============================================================================

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select coordinator_user_id::text from t_ids))::text, true);

select lives_ok(
  format(
    $$ select public.set_response_task_priority(%L, 'low') $$,
    (select seeded_task_id from t_ids)
  ),
  'set_response_task_priority() sets a non-critical priority without a reason'
);

select ok(
  (select priority from public.response_tasks where id = (select seeded_task_id from t_ids)) = 'low',
  'set_response_task_priority() persisted the new priority'
);

select throws_ok(
  format(
    $$ select public.set_response_task_priority(%L, 'critical') $$,
    (select seeded_task_id from t_ids)
  ),
  null,
  null,
  'set_response_task_priority() rejects critical priority without a reason'
);

select lives_ok(
  format(
    $$ select public.set_response_task_priority(%L, 'critical', 'Situasi memburuk secara signifikan') $$,
    (select seeded_task_id from t_ids)
  ),
  'set_response_task_priority() allows critical priority when a reason is given'
);

select ok(
  exists (
    select 1 from public.audit_events
    where entity_type = 'response_task' and action = 'response_task.priority_changed'
  ),
  'a response_task.priority_changed audit_event was appended'
);

reset role;

select * from finish();
rollback;
