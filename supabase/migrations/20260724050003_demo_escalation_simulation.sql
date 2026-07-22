-- BLOCK 25 — demo simulation tools: "simulate verified destroyed report"
-- and "deterministic cluster escalation," per this block's explicit demo
-- requirement. Both RPCs are SECURITY DEFINER, system_administrator-only
-- (matching claim_analysis_jobs/reclaim_stale_analysis_jobs's posture for
-- privileged tooling), and both insert real rows through the exact same
-- tables seed.sql already populates by hand — never a separate "fake data"
-- path — so the resulting report(s) behave identically to a real one for
-- every downstream screen (Verifier queue, Peta Krisis, escalation
-- evaluation). Every inserted evidence row uses a synthetic
-- storage_path/sha256_hash (no real file is uploaded), matching this
-- block's simulation intent, not a production evidence-upload substitute.

-- ============================================================================
-- simulate_verified_destroyed_report — inserts one fully-verified report
-- with a "destroyed" severity prediction at the given coordinates, then
-- immediately calls evaluate_escalations() so the caller sees the
-- resulting notification synchronously (this block's acceptance
-- criterion: "one event produces one deduplicated critical notification").
-- ============================================================================

create function public.simulate_verified_destroyed_report(
  p_disaster_event_id uuid,
  p_longitude double precision,
  p_latitude double precision
)
returns public.reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid;
  v_organization_id uuid;
  v_reporter_profile_id uuid;
  v_report public.reports;
  v_analysis_job_id uuid;
begin
  if not public.has_role('system_administrator') then
    raise exception 'simulate_verified_destroyed_report: caller must hold the system_administrator role' using errcode = '42501';
  end if;

  v_actor_profile_id := public.current_profile_id();

  select organization_id into v_organization_id from public.disaster_events where id = p_disaster_event_id;
  if v_organization_id is null then
    raise exception 'simulate_verified_destroyed_report: disaster_event % not found', p_disaster_event_id using errcode = 'P0002';
  end if;

  select p.id into v_reporter_profile_id
  from public.profiles p
  join public.role_assignments ra on ra.profile_id = p.id and ra.revoked_at is null
  where p.organization_id = v_organization_id and ra.role = 'reporter'
  limit 1;

  if v_reporter_profile_id is null then
    v_reporter_profile_id := v_actor_profile_id;
  end if;

  insert into public.reports (
    client_report_id, reporter_profile_id, disaster_event_id, status, description, submitted_at
  )
  values (
    gen_random_uuid(), v_reporter_profile_id, p_disaster_event_id, 'verified',
    '[Simulasi Demo] Laporan kerusakan parah untuk menguji eskalasi.',
    now()
  )
  returning * into v_report;

  insert into public.geolocation_observations (report_id, location, accuracy_meters, captured_at_client, confidence_signal)
  values (
    v_report.id, st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography, 5.0, now(), 0.95
  );

  insert into public.report_evidence (report_id, storage_path, mime_type, size_bytes, sha256_hash, perceptual_hash)
  values (
    v_report.id, 'report-evidence/demo-simulation/' || v_report.id || '.jpg', 'image/jpeg', 1,
    encode(digest('demo-simulation-' || v_report.id, 'sha256'), 'hex'), null
  );

  insert into public.analysis_jobs (report_id, status, claimed_by, attempts, completed_at)
  values (v_report.id, 'done', 'demo-simulation', 1, now())
  returning id into v_analysis_job_id;

  insert into public.model_predictions (analysis_job_id, report_id, severity_probabilities, quality_score, is_advisory_only)
  values (
    v_analysis_job_id, v_report.id,
    jsonb_build_object('unknown', 0.02, 'no_damage', 0.02, 'minor_damage', 0.03, 'major_damage', 0.13, 'destroyed', 0.80),
    0.900, false
  );

  insert into public.verification_reviews (report_id, verifier_profile_id, decision, notes)
  select v_report.id, p.id, 'confirm', '[Simulasi Demo] Dikonfirmasi otomatis untuk pengujian eskalasi.'
  from public.profiles p
  join public.role_assignments ra on ra.profile_id = p.id and ra.revoked_at is null
  where p.organization_id = v_organization_id and ra.role = 'verifier'
  limit 1;

  perform public.append_audit_event('report', v_report.id, 'demo.simulated_verified_destroyed_report',
    jsonb_build_object('disasterEventId', p_disaster_event_id));

  perform public.evaluate_escalations(v_organization_id);

  return v_report;
end;
$$;

grant execute on function public.simulate_verified_destroyed_report(uuid, double precision, double precision) to authenticated;

comment on function public.simulate_verified_destroyed_report(uuid, double precision, double precision) is
  'Demo tool (BLOCK 25) — inserts one fully-verified, destroyed-severity report at the given coordinates through the real reports/geolocation_observations/report_evidence/analysis_jobs/model_predictions/verification_reviews tables (no separate fake-data path), then evaluates escalations so the resulting notification is visible immediately. system_administrator only.';

-- ============================================================================
-- simulate_cluster_destroyed_escalation — deterministically produces the
-- "N destroyed within radius/time window" condition by inserting minCount
-- verified destroyed reports clustered within radiusMeters of one center
-- point, then evaluating escalations. Reuses
-- simulate_verified_destroyed_report internally (never duplicates its
-- insert logic) with small deterministic coordinate offsets.
-- ============================================================================

create function public.simulate_cluster_destroyed_escalation(
  p_disaster_event_id uuid,
  p_center_longitude double precision,
  p_center_latitude double precision
)
returns setof public.reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
  v_setting jsonb;
  v_count integer;
  v_offset_degrees double precision;
  v_i integer;
begin
  if not public.has_role('system_administrator') then
    raise exception 'simulate_cluster_destroyed_escalation: caller must hold the system_administrator role' using errcode = '42501';
  end if;

  select organization_id into v_organization_id from public.disaster_events where id = p_disaster_event_id;
  if v_organization_id is null then
    raise exception 'simulate_cluster_destroyed_escalation: disaster_event % not found', p_disaster_event_id using errcode = 'P0002';
  end if;

  select value into v_setting
  from public.system_settings
  where organization_id = v_organization_id and key = 'escalation.cluster_destroyed_radius';

  v_count := coalesce((v_setting->>'minCount')::integer, 3);
  -- A small, deterministic offset (roughly 100m at the equator per 0.001
  -- degree) well inside any realistic radiusMeters threshold, so the
  -- simulated reports reliably fall within the configured radius without
  -- needing a full great-circle offset calculation for a demo tool.
  v_offset_degrees := 0.001;

  for v_i in 0..(v_count - 1) loop
    return next public.simulate_verified_destroyed_report(
      p_disaster_event_id,
      p_center_longitude + (v_i * v_offset_degrees),
      p_center_latitude + (v_i * v_offset_degrees)
    );
  end loop;

  return;
end;
$$;

grant execute on function public.simulate_cluster_destroyed_escalation(uuid, double precision, double precision) to authenticated;

comment on function public.simulate_cluster_destroyed_escalation(uuid, double precision, double precision) is
  'Demo tool (BLOCK 25) — deterministically triggers the cluster_destroyed_radius escalation rule by inserting escalation.cluster_destroyed_radius''s configured minCount verified destroyed reports within a small deterministic offset of the given center point. system_administrator only.';
