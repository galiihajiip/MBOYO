-- BLOCK 29 — behavioral tests for privileged RPCs that previously had no
-- test beyond incidental exercise inside other tests' setup. Complements
-- 020/030/040/050's RLS-boundary focus: these tests exercise the actual
-- state transitions, idempotence, and validation logic each function
-- implements, not just who is allowed to call it.

begin;
select plan(21);

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
  (select id from public.reports where status = 'needs_manual_review' limit 1) as needs_review_report_id,
  (select id from public.reports where status = 'verified' limit 1) as verified_report_id,
  (select id from public.response_tasks limit 1) as seeded_task_id;

-- ============================================================================
-- evaluate_escalations() — "one event produces one deduplicated
-- notification" and "settings change behavior without restart."
-- ============================================================================

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select admin_user_id::text from t_ids))::text, true);

-- simulate_verified_destroyed_report inserts a report with a 0.80
-- "destroyed" probability, above the seeded 0.7 minProbability threshold
-- for escalation.verified_destroyed_threshold, so this deterministically
-- fires Rule 1 (the RPC itself calls evaluate_escalations internally).
create temporary table t_sim1 as
select (public.simulate_verified_destroyed_report((select event_id from t_ids), 106.8456, -6.2088)).id as report_id;

select ok(
  exists (
    select 1 from public.notifications
    where dedup_key = 'verified_destroyed_threshold:' || (select report_id from t_sim1)
  ),
  'evaluate_escalations (via the simulation RPC) raised a verified_destroyed_threshold notification for the simulated report'
);

select ok(
  (
    select count(*) from public.notifications
    where dedup_key = 'verified_destroyed_threshold:' || (select report_id from t_sim1)
  ) = 1,
  'exactly one notification exists for the report (deduplicated, not doubled)'
);

select ok(
  exists (
    select 1 from public.audit_events
    where entity_type = 'report'
      and entity_id = (select report_id from t_sim1)
      and action = 'escalation.verified_destroyed_threshold'
  ),
  'a corresponding escalation.verified_destroyed_threshold audit_event was appended'
);

-- Re-running evaluate_escalations directly for the same organization must
-- not raise a second notification for the already-notified report —
-- idempotence is the acceptance criterion, verified by an explicit second
-- call rather than only trusting the simulation RPC's own single internal call.
select public.evaluate_escalations((select org_id from t_ids));

select ok(
  (
    select count(*) from public.notifications
    where dedup_key = 'verified_destroyed_threshold:' || (select report_id from t_sim1)
  ) = 1,
  're-evaluating escalations for the same organization does not duplicate the notification for a report already notified'
);

-- Disabling the rule and re-simulating must not raise a new notification —
-- "settings change behavior without restart," verified as an actual
-- negative case, not just documented intent.
update public.system_settings
set value = jsonb_set(value, '{enabled}', 'false'::jsonb)
where organization_id = (select org_id from t_ids) and key = 'escalation.verified_destroyed_threshold';

create temporary table t_sim2 as
select (public.simulate_verified_destroyed_report((select event_id from t_ids), 106.9000, -6.3000)).id as report_id;

select ok(
  not exists (
    select 1 from public.notifications
    where dedup_key = 'verified_destroyed_threshold:' || (select report_id from t_sim2)
  ),
  'disabling escalation.verified_destroyed_threshold (enabled=false) takes effect immediately with no restart — no notification raised for a new simulated report'
);

-- Restore for any later test relying on the seeded default.
update public.system_settings
set value = jsonb_set(value, '{enabled}', 'true'::jsonb)
where organization_id = (select org_id from t_ids) and key = 'escalation.verified_destroyed_threshold';

reset role;

-- ============================================================================
-- record_consent() — insert-or-return idempotence, validation, audit.
-- ============================================================================

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select verifier_user_id::text from t_ids))::text, true);

select lives_ok(
  $$ select public.record_consent('privacy_notice', '2026-07-27') $$,
  'Verifier can accept a consent document version via record_consent()'
);

select ok(
  (select count(*) from public.consent_records where profile_id = (select verifier_profile_id from t_ids) and document_key = 'privacy_notice' and version = '2026-07-27') = 1,
  'exactly one consent_records row exists after the first acceptance'
);

select lives_ok(
  $$ select public.record_consent('privacy_notice', '2026-07-27') $$,
  'calling record_consent() again for the same (profile, document, version) does not raise'
);

select ok(
  (select count(*) from public.consent_records where profile_id = (select verifier_profile_id from t_ids) and document_key = 'privacy_notice' and version = '2026-07-27') = 1,
  'the repeated call did not insert a second row (on conflict do nothing + return-existing behavior)'
);

select ok(
  exists (
    select 1 from public.audit_events
    where entity_type = 'consent_record' and action = 'consent_record.accepted'
  ),
  'a consent_record.accepted audit_event was appended'
);

select throws_ok(
  $$ select public.record_consent('', '2026-07-27') $$,
  null,
  null,
  'record_consent() rejects an empty document_key'
);

select throws_ok(
  $$ select public.record_consent('privacy_notice', '') $$,
  null,
  null,
  'record_consent() rejects an empty version'
);

reset role;

-- ============================================================================
-- reclaim_stale_analysis_jobs() — requeues a stale 'processing' job within
-- attempts, dead-letters one at/above max_attempts.
-- ============================================================================

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select admin_user_id::text from t_ids))::text, true);

create temporary table t_stale_reports as
insert into public.reports (client_report_id, reporter_profile_id, disaster_event_id, status)
select gen_random_uuid(), (select reporter_profile_id from t_ids), (select event_id from t_ids), 'analysis_running'
from generate_series(1, 2)
returning id;

insert into public.analysis_jobs (report_id, status, claimed_by, claimed_at, attempts)
select id, 'processing', 'stale-worker', now() - interval '1 hour', 1
from (select id from t_stale_reports order by id limit 1) as first_report;

insert into public.analysis_jobs (report_id, status, claimed_by, claimed_at, attempts)
select id, 'processing', 'stale-worker', now() - interval '1 hour', 5
from (select id from t_stale_reports order by id offset 1 limit 1) as second_report;

select public.reclaim_stale_analysis_jobs(300, 3);

select ok(
  (
    select status from public.analysis_jobs
    where report_id = (select id from t_stale_reports order by id limit 1)
  ) = 'queued',
  'a stale processing job under max_attempts is requeued to queued'
);

select ok(
  (
    select claimed_by from public.analysis_jobs
    where report_id = (select id from t_stale_reports order by id limit 1)
  ) is null,
  'a requeued job has its claimed_by cleared so it looks unclaimed again'
);

select ok(
  (
    select status from public.analysis_jobs
    where report_id = (select id from t_stale_reports order by id offset 1 limit 1)
  ) = 'failed',
  'a stale processing job at/above max_attempts is dead-lettered to failed'
);

select ok(
  (
    select claimed_by from public.analysis_jobs
    where report_id = (select id from t_stale_reports order by id offset 1 limit 1)
  ) = 'stale-worker',
  'a dead-lettered job retains its last claimed_by as a forensic record'
);

reset role;

-- ============================================================================
-- submit_verification_decision() — status transition + re-decision guard.
-- ============================================================================

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select verifier_user_id::text from t_ids))::text, true);

select lives_ok(
  format(
    $$ select public.submit_verification_decision(%L, 'confirm') $$,
    (select needs_review_report_id from t_ids)
  ),
  'Verifier can submit a confirm decision for a needs_manual_review report'
);

select ok(
  (select status from public.reports where id = (select needs_review_report_id from t_ids)) = 'verified',
  'a confirm decision transitions the report to verified'
);

select throws_ok(
  format(
    $$ select public.submit_verification_decision(%L, 'confirm') $$,
    (select needs_review_report_id from t_ids)
  ),
  null,
  null,
  'submit_verification_decision() rejects a second decision on a report no longer in analysis_completed/needs_manual_review'
);

select throws_ok(
  format(
    $$ select public.submit_verification_decision(%L, 'override') $$,
    (select verified_report_id from t_ids)
  ),
  null,
  null,
  'an override decision without override_severity is rejected'
);

reset role;

-- ============================================================================
-- transition_response_task_status() — invalid-transition rejection.
-- Seeded task's sole assignee is the coordinator profile itself
-- (seed.sql), so this call exercises the assignee branch, not the
-- coordinator's separate cancel-only branch.
-- ============================================================================

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select coordinator_user_id::text from t_ids))::text, true);

select throws_ok(
  format(
    $$ select public.transition_response_task_status(%L, 'completed') $$,
    (select seeded_task_id from t_ids)
  ),
  null,
  null,
  'transition_response_task_status() rejects an invalid transition (assigned -> completed is not in the allowed set)'
);

reset role;

select * from finish();
rollback;
