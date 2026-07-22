-- BLOCK 27 — Admin's "users/roles" and "events" management RPCs. Both
-- write to tables whose RLS already fully permits system_administrator
-- (profiles_admin_all/role_assignments_admin_all/disaster_events_admin_all,
-- all from BLOCK 08) — these RPCs exist for the same reason every other
-- privileged write in this codebase uses one: atomic multi-step writes
-- (e.g. revoking an old role assignment before granting a new one) and a
-- guaranteed audit event, not because RLS is insufficient on its own.
-- Every RPC here explicitly calls append_audit_event itself, in addition
-- to the system_settings_audit_trigger this block also adds — these
-- tables have no equivalent trigger (role_assignments/disaster_events
-- changes are semantically different events worth their own action
-- names, e.g. 'role_assignment.granted' vs a generic '.updated').

-- ============================================================================
-- grant_role — assigns a role to a profile. If the profile already holds
-- an active assignment for that same role, this is a no-op returning the
-- existing row (idempotent) rather than violating
-- role_assignments_active_unique_idx.
-- ============================================================================

create function public.grant_role(
  p_profile_id uuid,
  p_role public.app_role
)
returns public.role_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid;
  v_organization_id uuid;
  v_row public.role_assignments;
begin
  if not public.has_role('system_administrator') then
    raise exception 'grant_role: caller must hold the system_administrator role' using errcode = '42501';
  end if;

  v_actor_profile_id := public.current_profile_id();

  select organization_id into v_organization_id from public.profiles where id = p_profile_id;
  if v_organization_id is null then
    raise exception 'grant_role: profile % not found', p_profile_id using errcode = 'P0002';
  end if;

  select * into v_row
  from public.role_assignments
  where profile_id = p_profile_id and role = p_role and revoked_at is null;

  if found then
    return v_row;
  end if;

  insert into public.role_assignments (profile_id, organization_id, role, granted_by)
  values (p_profile_id, v_organization_id, p_role, v_actor_profile_id)
  returning * into v_row;

  perform public.append_audit_event(
    'role_assignment',
    v_row.id,
    'role_assignment.granted',
    jsonb_build_object('profileId', p_profile_id, 'role', p_role)
  );

  return v_row;
end;
$$;

grant execute on function public.grant_role(uuid, public.app_role) to authenticated;

-- ============================================================================
-- revoke_role — sets revoked_at on an active assignment. Idempotent: an
-- already-revoked (or nonexistent) assignment simply raises not-found,
-- since there is no row identity to revoke twice.
-- ============================================================================

create function public.revoke_role(
  p_profile_id uuid,
  p_role public.app_role
)
returns public.role_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.role_assignments;
begin
  if not public.has_role('system_administrator') then
    raise exception 'revoke_role: caller must hold the system_administrator role' using errcode = '42501';
  end if;

  update public.role_assignments
  set revoked_at = now()
  where profile_id = p_profile_id and role = p_role and revoked_at is null
  returning * into v_row;

  if not found then
    raise exception 'revoke_role: no active % assignment found for profile %', p_role, p_profile_id using errcode = 'P0002';
  end if;

  perform public.append_audit_event(
    'role_assignment',
    v_row.id,
    'role_assignment.revoked',
    jsonb_build_object('profileId', p_profile_id, 'role', p_role)
  );

  return v_row;
end;
$$;

grant execute on function public.revoke_role(uuid, public.app_role) to authenticated;

-- ============================================================================
-- create_disaster_event / update_disaster_event — Admin's "Event Bencana"
-- CRUD. Geofence is accepted as GeoJSON text (matching
-- disaster_event_geofence_geojson's inverse conversion, BLOCK 24) and
-- converted via st_geomfromgeojson — never accepted as a raw WKT string,
-- since GeoJSON is what every other geospatial boundary in this codebase
-- (client-drawn geofences) is already expressed as.
-- ============================================================================

create function public.create_disaster_event(
  p_name text,
  p_geofence_geojson text default null,
  p_starts_at timestamptz default now()
)
returns public.disaster_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid;
  v_organization_id uuid;
  v_row public.disaster_events;
begin
  if not public.has_role('system_administrator') then
    raise exception 'create_disaster_event: caller must hold the system_administrator role' using errcode = '42501';
  end if;

  v_actor_profile_id := public.current_profile_id();
  select organization_id into v_organization_id from public.profiles where id = v_actor_profile_id;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'create_disaster_event: name is required' using errcode = '22023';
  end if;

  insert into public.disaster_events (organization_id, name, geofence, starts_at)
  values (
    v_organization_id,
    trim(p_name),
    case when p_geofence_geojson is not null then st_geomfromgeojson(p_geofence_geojson)::geography else null end,
    p_starts_at
  )
  returning * into v_row;

  perform public.append_audit_event(
    'disaster_event',
    v_row.id,
    'disaster_event.created',
    jsonb_build_object('name', v_row.name, 'hasGeofence', p_geofence_geojson is not null)
  );

  return v_row;
end;
$$;

grant execute on function public.create_disaster_event(text, text, timestamptz) to authenticated;

create function public.update_disaster_event(
  p_disaster_event_id uuid,
  p_name text default null,
  p_status public.disaster_event_status default null,
  p_geofence_geojson text default null,
  p_ends_at timestamptz default null
)
returns public.disaster_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.disaster_events;
begin
  if not public.has_role('system_administrator') then
    raise exception 'update_disaster_event: caller must hold the system_administrator role' using errcode = '42501';
  end if;

  update public.disaster_events
  set
    name = coalesce(trim(p_name), name),
    status = coalesce(p_status, status),
    geofence = case when p_geofence_geojson is not null then st_geomfromgeojson(p_geofence_geojson)::geography else geofence end,
    ends_at = coalesce(p_ends_at, ends_at)
  where id = p_disaster_event_id
  returning * into v_row;

  if not found then
    raise exception 'update_disaster_event: disaster_event % not found', p_disaster_event_id using errcode = 'P0002';
  end if;

  perform public.append_audit_event(
    'disaster_event',
    v_row.id,
    'disaster_event.updated',
    jsonb_build_object('name', v_row.name, 'status', v_row.status)
  );

  return v_row;
end;
$$;

grant execute on function public.update_disaster_event(uuid, text, public.disaster_event_status, text, timestamptz) to authenticated;
