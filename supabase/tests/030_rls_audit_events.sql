-- RLS tests for public.audit_events — the append-only guarantee at the
-- heart of docs/security/THREAT_MODEL.md threat #12. No role, including
-- System Administrator, may UPDATE or DELETE an audit_events row; INSERT is
-- only possible via public.append_audit_event(), never a direct table INSERT.

begin;
select plan(6);

create temporary table t_audit_ids as
select
  (select user_id from public.profiles where display_name like 'Agus Santoso%') as admin_user_id,
  (select user_id from public.profiles where display_name like 'Rina Wijaya%') as auditor_user_id,
  (select id from public.audit_events limit 1) as sample_audit_event_id;

-- ----------------------------------------------------------------------------
-- Admin and Auditor can both read audit_events.
-- ----------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select admin_user_id::text from t_audit_ids))::text, true);

select ok(
  (select count(*) from public.audit_events) > 0,
  'System Administrator can read audit_events'
);

select throws_ok(
  format(
    $$ update public.audit_events set action = %L where id = %L $$,
    'tampered', (select sample_audit_event_id from t_audit_ids)
  ),
  null,
  null,
  'System Administrator cannot UPDATE an audit_events row'
);

select throws_ok(
  format(
    $$ delete from public.audit_events where id = %L $$,
    (select sample_audit_event_id from t_audit_ids)
  ),
  null,
  null,
  'System Administrator cannot DELETE an audit_events row'
);

reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select auditor_user_id::text from t_audit_ids))::text, true);

select ok(
  (select count(*) from public.audit_events) > 0,
  'Auditor can read audit_events'
);

select throws_ok(
  format(
    $$ insert into public.audit_events (entity_type, entity_id, action) values ('report', gen_random_uuid(), 'fake.event') $$
  ),
  null,
  null,
  'Auditor cannot directly INSERT into audit_events (no insert policy — only append_audit_event() may write)'
);

reset role;

-- ----------------------------------------------------------------------------
-- append_audit_event() is the sanctioned write path and succeeds for an
-- authenticated user.
-- ----------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select auditor_user_id::text from t_audit_ids))::text, true);

select lives_ok(
  format(
    $$ select public.append_audit_event('report', %L, 'test.audit_event') $$,
    (select sample_audit_event_id from t_audit_ids)
  ),
  'append_audit_event() succeeds as the sanctioned write path'
);

reset role;

select * from finish();
rollback;
