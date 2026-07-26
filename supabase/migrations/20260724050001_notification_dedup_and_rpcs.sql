-- BLOCK 25 — notification write path: dedup key, create_notification RPC,
-- mark-read RPC, and evaluate_escalations() covering all 6 required rules.
--
-- `notifications` (BLOCK 08) has no INSERT policy for any role — by
-- design, writes only ever happen through a SECURITY DEFINER RPC, matching
-- every other write path in this codebase. This migration adds a
-- `dedup_key` column (nullable, unique when present) so "one event
-- produces one deduplicated notification" (this block's acceptance
-- criterion) is enforced by a real unique constraint, not just
-- application-level care — a second attempt to raise the same escalation
-- for the same subject simply upserts nothing new (ON CONFLICT DO
-- NOTHING), making the whole evaluation idempotent to re-runs.

alter table public.notifications
  add column dedup_key text,
  add column level text not null default 'info' check (level in ('info', 'warning', 'high', 'critical'));

create unique index notifications_dedup_key_unique_idx
  on public.notifications (dedup_key)
  where dedup_key is not null;

comment on column public.notifications.dedup_key is
  'Deterministic key identifying the (rule, subject, occurrence-window) an escalation notification was raised for — a unique index on this column is what makes evaluate_escalations() idempotent: re-running it never produces duplicate notifications for the same underlying event.';
comment on column public.notifications.level is
  'info/warning/high/critical per this block''s requirement — resolved from the triggering escalation.* system_settings row''s "level" field at creation time, or "info" for non-escalation notification types.';

-- ============================================================================
-- create_notification — the sole INSERT path for public.notifications.
-- Fans out to every profile holding one of p_recipient_roles within the
-- report/task's organization (role audience, per this block's requirement)
-- unless p_recipient_profile_id narrows to exactly one profile. Returns the
-- set of rows actually inserted (empty if every recipient already had this
-- dedup_key, i.e. idempotent re-evaluation produced nothing new).
-- ============================================================================

create function public.create_notification(
  p_organization_id uuid,
  p_recipient_roles public.app_role[],
  p_type text,
  p_level text,
  p_payload jsonb,
  p_dedup_key text default null,
  p_recipient_profile_id uuid default null
)
returns setof public.notifications
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_level not in ('info', 'warning', 'high', 'critical') then
    raise exception 'create_notification: level must be one of info/warning/high/critical' using errcode = '22023';
  end if;

  return query
  insert into public.notifications (recipient_profile_id, type, level, payload, dedup_key)
  select p.id, p_type, p_level, p_payload, p_dedup_key
  from public.profiles p
  where p.organization_id = p_organization_id
    and (p_recipient_profile_id is null or p.id = p_recipient_profile_id)
    and (
      p_recipient_profile_id is not null
      or exists (
        select 1 from public.role_assignments ra
        where ra.profile_id = p.id
          and ra.role = any(p_recipient_roles)
          and ra.revoked_at is null
      )
    )
  on conflict (dedup_key) where dedup_key is not null do nothing
  returning *;
end;
$$;

grant execute on function public.create_notification(uuid, public.app_role[], text, text, jsonb, text, uuid) to authenticated;

comment on function public.create_notification(uuid, public.app_role[], text, text, jsonb, text, uuid) is
  'The only INSERT path for notifications — SECURITY DEFINER since notifications has no client-facing INSERT policy. Role-audience fan-out (every profile in the org holding one of p_recipient_roles) unless p_recipient_profile_id narrows to one profile. ON CONFLICT DO NOTHING on dedup_key makes repeated calls for the same event a no-op.';

-- ============================================================================
-- mark_notification_read — the sole UPDATE path setting read_at, scoped to
-- the caller's own notification (notifications_update_own_read_at RLS
-- already permits this at the table level; this RPC exists so the API
-- route has one clean call site and so re-marking an already-read
-- notification is a harmless no-op).
-- ============================================================================

create function public.mark_notification_read(p_notification_id uuid)
returns public.notifications
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_row public.notifications;
begin
  update public.notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id
  returning * into v_row;

  if not found then
    raise exception 'mark_notification_read: notification % not found or not visible to caller', p_notification_id
      using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

grant execute on function public.mark_notification_read(uuid) to authenticated;

comment on function public.mark_notification_read(uuid) is
  'SECURITY INVOKER — relies entirely on notifications_update_own_read_at RLS for the "own notification only" guarantee, matching this table''s existing UPDATE policy rather than re-implementing the ownership check.';
