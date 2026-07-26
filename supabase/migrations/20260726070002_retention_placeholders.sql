-- BLOCK 27 — retention: offline cleanup, evidence retention, a deletion-
-- request workflow PLACEHOLDER, a legal-hold PLACEHOLDER, and audit
-- retention kept separate from evidence retention. Per this block's
-- prompt these are explicitly placeholders (docs/product/PRODUCTION_SCOPE.md
-- already discloses "retention policy... enforced by a scheduled job" is
-- Production-tier, not MVP/Capstone-tier) — this migration adds the real
-- schema/RLS/audit wiring a placeholder workflow needs to be honest and
-- inspectable (not a fake UI over nothing), but does NOT add a scheduled
-- deletion job — no such job exists anywhere in this codebase (no cron
-- infrastructure at all, confirmed by BLOCK 25's research), and building
-- one is explicitly a separate, later roadmap item
-- (docs/product/DELIVERY_ROADMAP.md "Retention policy enforcement job").

-- ============================================================================
-- Retention policy settings — reuses system_settings under a retention.*
-- namespace, exactly mirroring BLOCK 25's escalation.* pattern (same RLS,
-- same audit trigger from this block's system_settings_audit_trigger).
-- Values are periods in days; enforcement of these values (actually
-- deleting/archiving on schedule) is the disclosed, out-of-scope part —
-- this seeds the DECLARED policy an Auditor can read and compare against
-- actual data age, per this block's "retention/deletion evidence" Auditor
-- requirement.
-- ============================================================================

insert into public.system_settings (organization_id, key, value)
select
  o.id,
  rule.key,
  rule.value
from public.organizations o
cross join (
  values
    ('retention.evidence_retention_days', '{"days": 365, "enabled": true}'::jsonb),
    ('retention.audit_retention_days', '{"days": 2555, "enabled": true}'::jsonb)
) as rule(key, value)
on conflict (organization_id, key) do nothing;

comment on table public.system_settings is
  'Org-scoped key/value settings. escalation.* (BLOCK 25) and retention.* (BLOCK 27) key namespaces both live here — see each block''s own migration comment. Every write is audited unconditionally by system_settings_audit_trigger (BLOCK 27).';

-- ============================================================================
-- deletion_requests — placeholder workflow for "a reporter/subject asks
-- for their data to be deleted." Per this block's explicit "placeholder"
-- scope: this table lets the request be recorded, tracked through a
-- status, and reviewed by an Admin — it does NOT itself perform any
-- deletion (no trigger/job deletes rows when a request is marked
-- 'approved'). The actual deletion mechanism is future, disclosed work;
-- this is the honest, inspectable shell for it.
-- ============================================================================

create type public.deletion_request_status as enum (
  'pending',
  'approved',
  'denied',
  'completed'
);

create table public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by_profile_id uuid not null references public.profiles (id) on delete restrict,
  subject_report_id uuid references public.reports (id) on delete set null,
  reason text not null,
  status public.deletion_request_status not null default 'pending',
  reviewed_by_profile_id uuid references public.profiles (id) on delete set null,
  review_notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index deletion_requests_status_idx on public.deletion_requests (status);
create index deletion_requests_requested_by_profile_id_idx on public.deletion_requests (requested_by_profile_id);

comment on table public.deletion_requests is
  'BLOCK 27 placeholder — records a data-deletion request and its Admin review status. Does NOT itself delete anything; a real deletion-execution mechanism is disclosed future work, not implemented here.';

alter table public.deletion_requests enable row level security;
alter table public.deletion_requests force row level security;

create policy deletion_requests_insert_own on public.deletion_requests
  for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = deletion_requests.requested_by_profile_id
        and p.user_id = auth.uid()
    )
  );

create policy deletion_requests_select_own on public.deletion_requests
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = deletion_requests.requested_by_profile_id
        and p.user_id = auth.uid()
    )
  );

create policy deletion_requests_admin_all on public.deletion_requests
  for all
  using (public.has_role('system_administrator'))
  with check (public.has_role('system_administrator'));

create policy deletion_requests_auditor_select on public.deletion_requests
  for select
  using (public.has_role('auditor'));

-- ============================================================================
-- review_deletion_request — the only sanctioned status-transition path,
-- always audited. Mirrors submit_verification_decision's shape at a much
-- smaller scale: role guard, row lock, transition, audit.
-- ============================================================================

create function public.review_deletion_request(
  p_deletion_request_id uuid,
  p_status public.deletion_request_status,
  p_review_notes text default null
)
returns public.deletion_requests
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor_profile_id uuid;
  v_row public.deletion_requests;
begin
  if not public.has_role('system_administrator') then
    raise exception 'review_deletion_request: caller must hold the system_administrator role' using errcode = '42501';
  end if;
  if p_status = 'pending' then
    raise exception 'review_deletion_request: cannot transition back to pending' using errcode = '22023';
  end if;

  v_actor_profile_id := public.current_profile_id();

  update public.deletion_requests
  set status = p_status, reviewed_by_profile_id = v_actor_profile_id, review_notes = p_review_notes, reviewed_at = now()
  where id = p_deletion_request_id
  returning * into v_row;

  if not found then
    raise exception 'review_deletion_request: deletion_request % not found', p_deletion_request_id using errcode = 'P0002';
  end if;

  perform public.append_audit_event(
    'deletion_request',
    v_row.id,
    'deletion_request.' || p_status,
    jsonb_build_object('reviewNotes', p_review_notes)
  );

  return v_row;
end;
$$;

grant execute on function public.review_deletion_request(uuid, public.deletion_request_status, text) to authenticated;

-- ============================================================================
-- legal_holds — placeholder: a hold on a report/disaster_event that (once
-- a real retention-enforcement job exists) would prevent it from being
-- auto-deleted/archived. No enforcement mechanism reads this table yet —
-- disclosed as a placeholder exactly like deletion_requests above.
-- ============================================================================

create table public.legal_holds (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.reports (id) on delete cascade,
  disaster_event_id uuid references public.disaster_events (id) on delete cascade,
  reason text not null,
  placed_by_profile_id uuid not null references public.profiles (id) on delete restrict,
  placed_at timestamptz not null default now(),
  released_at timestamptz,
  released_by_profile_id uuid references public.profiles (id) on delete set null,
  constraint legal_holds_exactly_one_target check (
    (report_id is not null and disaster_event_id is null)
    or (report_id is null and disaster_event_id is not null)
  )
);

create index legal_holds_report_id_idx on public.legal_holds (report_id) where report_id is not null;
create index legal_holds_disaster_event_id_idx on public.legal_holds (disaster_event_id) where disaster_event_id is not null;
create unique index legal_holds_active_report_unique_idx on public.legal_holds (report_id) where released_at is null and report_id is not null;
create unique index legal_holds_active_event_unique_idx on public.legal_holds (disaster_event_id) where released_at is null and disaster_event_id is not null;

comment on table public.legal_holds is
  'BLOCK 27 placeholder — records that a report or disaster_event is under legal/compliance hold. No retention-enforcement job reads this table yet (none exists in this codebase) — it exists so a hold can be declared/inspected honestly ahead of that future enforcement mechanism.';

alter table public.legal_holds enable row level security;
alter table public.legal_holds force row level security;

create policy legal_holds_admin_all on public.legal_holds
  for all
  using (public.has_role('system_administrator'))
  with check (public.has_role('system_administrator'));

create policy legal_holds_auditor_select on public.legal_holds
  for select
  using (public.has_role('auditor'));

create function public.place_legal_hold(
  p_reason text,
  p_report_id uuid default null,
  p_disaster_event_id uuid default null
)
returns public.legal_holds
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor_profile_id uuid;
  v_row public.legal_holds;
begin
  if not public.has_role('system_administrator') then
    raise exception 'place_legal_hold: caller must hold the system_administrator role' using errcode = '42501';
  end if;
  if (p_report_id is null) = (p_disaster_event_id is null) then
    raise exception 'place_legal_hold: exactly one of report_id or disaster_event_id is required' using errcode = '22023';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'place_legal_hold: reason is required' using errcode = '22023';
  end if;

  v_actor_profile_id := public.current_profile_id();

  insert into public.legal_holds (report_id, disaster_event_id, reason, placed_by_profile_id)
  values (p_report_id, p_disaster_event_id, trim(p_reason), v_actor_profile_id)
  returning * into v_row;

  perform public.append_audit_event(
    'legal_hold',
    v_row.id,
    'legal_hold.placed',
    jsonb_build_object('reportId', p_report_id, 'disasterEventId', p_disaster_event_id, 'reason', v_row.reason)
  );

  return v_row;
end;
$$;

grant execute on function public.place_legal_hold(text, uuid, uuid) to authenticated;

create function public.release_legal_hold(p_legal_hold_id uuid)
returns public.legal_holds
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor_profile_id uuid;
  v_row public.legal_holds;
begin
  if not public.has_role('system_administrator') then
    raise exception 'release_legal_hold: caller must hold the system_administrator role' using errcode = '42501';
  end if;

  v_actor_profile_id := public.current_profile_id();

  update public.legal_holds
  set released_at = now(), released_by_profile_id = v_actor_profile_id
  where id = p_legal_hold_id and released_at is null
  returning * into v_row;

  if not found then
    raise exception 'release_legal_hold: no active legal hold % found', p_legal_hold_id using errcode = 'P0002';
  end if;

  perform public.append_audit_event('legal_hold', v_row.id, 'legal_hold.released', '{}'::jsonb);

  return v_row;
end;
$$;

grant execute on function public.release_legal_hold(uuid) to authenticated;
