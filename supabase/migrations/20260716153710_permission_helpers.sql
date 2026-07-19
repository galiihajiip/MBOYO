-- Permission helper functions used by RLS policies (next migration) and by
-- application code that needs to check a caller's role/profile without
-- duplicating the underlying query everywhere.
--
-- All helpers are STABLE (not VOLATILE) since they only read data within a
-- single statement's snapshot, and SECURITY INVOKER (the default) so they
-- run with the calling role's own RLS-filtered view — a helper must never
-- silently grant broader access than the caller already has.

-- Returns the calling user's own profile id, or NULL if they have none
-- (e.g. not yet provisioned, or an unauthenticated request under the anon key).
create function public.current_profile_id()
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select id from public.profiles where user_id = auth.uid();
$$;

-- True if the current user holds the given active (non-revoked) role.
create function public.has_role(check_role public.app_role)
returns boolean
language sql
stable
security invoker
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

-- True if the current user holds ANY of the given roles — convenience for
-- policies that allow multiple roles (e.g. read access shared by Verifier
-- and Response Coordinator).
create function public.has_any_role(check_roles public.app_role[])
returns boolean
language sql
stable
security invoker
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

-- True if the given report_id belongs to the current user (Reporter-owned
-- reports check) — used repeatedly across report/report_evidence/
-- geolocation_observations policies.
create function public.owns_report(check_report_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.reports r
    join public.profiles p on p.id = r.reporter_profile_id
    where r.id = check_report_id
      and p.user_id = auth.uid()
  );
$$;

comment on function public.current_profile_id() is
  'Returns the calling auth user''s own profiles.id, or NULL if unprovisioned.';
comment on function public.has_role(public.app_role) is
  'True if the calling user holds the given role via an active (non-revoked) role_assignment.';
comment on function public.has_any_role(public.app_role[]) is
  'True if the calling user holds any of the given roles via an active role_assignment.';
comment on function public.owns_report(uuid) is
  'True if the given report belongs to the calling user (Reporter ownership check).';
