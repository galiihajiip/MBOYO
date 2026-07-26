-- Fixes infinite recursion in role checks: role_assignments_admin_all (on
-- public.role_assignments) calls has_role('system_administrator'), and
-- has_role/has_any_role query public.role_assignments themselves — with
-- both functions SECURITY INVOKER, that inner query re-evaluates
-- role_assignments' own RLS policies (including role_assignments_admin_all
-- again), recursing until Postgres raises "stack depth limit exceeded"
-- (errcode 54001). This makes every has_role()/has_any_role() call fail —
-- silently, wherever the caller wraps the query in a try/catch (e.g.
-- proxy.ts's middleware role lookup) — so an authenticated user with a
-- real role_assignments row is treated as having no roles at all.
--
-- Fix: has_role/has_any_role become SECURITY DEFINER so their internal
-- read of role_assignments bypasses RLS entirely (breaking the recursive
-- policy re-entry) — they still only ever return a boolean derived from
-- auth.uid()'s own rows, so this grants no new data access, only stops the
-- self-referential policy evaluation. current_profile_id() and
-- owns_report() are unaffected (they don't query role_assignments) and are
-- left as SECURITY INVOKER.

create or replace function public.has_role(check_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.role_assignments ra
    join public.profiles p on p.id = ra.profile_id
    where p.user_id = auth.uid()
      and ra.role = check_role
      and ra.revoked_at is null
  );
$$;

create or replace function public.has_any_role(check_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.role_assignments ra
    join public.profiles p on p.id = ra.profile_id
    where p.user_id = auth.uid()
      and ra.role = any(check_roles)
      and ra.revoked_at is null
  );
$$;

comment on function public.has_role(public.app_role) is
  'True if the calling user holds the given role via an active (non-revoked) role_assignment. SECURITY DEFINER (see this migration''s header) so its internal role_assignments read does not re-trigger that table''s own RLS policies, which would otherwise recurse infinitely through role_assignments_admin_all.';
comment on function public.has_any_role(public.app_role[]) is
  'True if the calling user holds any of the given roles via an active role_assignment. SECURITY DEFINER for the same reason as has_role() above.';
