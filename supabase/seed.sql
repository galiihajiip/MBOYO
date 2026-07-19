-- MBOYO local demo seed data.
--
-- Seeds: one organization, one active disaster_event, one demo auth user per
-- role (all five roles), reports spanning a representative spread of
-- docs/product/STATE_MACHINES.md states, model_predictions/model_explanations
-- for analyzed reports, a response_task, notifications, model registry
-- versions (one promoted + one advisory-only candidate), and audit_events
-- for the full report → analysis → verification → dispatch lineage of one
-- report, so the Auditor's Audit Trail / Laporan Read-Only screens
-- (docs/product/SCREEN_INVENTORY.md) have something real to display.
--
-- Demo auth users are inserted directly into auth.users (local-dev only —
-- this bypasses the Auth API's signup flow, which is fine for `supabase db
-- reset` seeding but must never be done against a hosted/production
-- project). All demo accounts share the password "DemoMboyo2026!" — never
-- used outside local development, and the demo-account chooser
-- (apps/web/src/app/(auth)/masuk/DemoAccountChooser.tsx) that surfaces
-- these credentials in the UI only renders when DEMO_MODE is enabled
-- (docs/product/BLOCK 09 auth requirements).

do $$
declare
  v_org_id uuid;
  v_event_id uuid;

  v_reporter_user_id uuid := '00000000-0000-0000-0000-000000000001';
  v_verifier_user_id uuid := '00000000-0000-0000-0000-000000000002';
  v_coordinator_user_id uuid := '00000000-0000-0000-0000-000000000003';
  v_admin_user_id uuid := '00000000-0000-0000-0000-000000000004';
  v_auditor_user_id uuid := '00000000-0000-0000-0000-000000000005';

  v_reporter_profile_id uuid;
  v_verifier_profile_id uuid;
  v_coordinator_profile_id uuid;
  v_admin_profile_id uuid;
  v_auditor_profile_id uuid;

  v_model_v1_id uuid;
  v_model_v2_candidate_id uuid;

  v_report_verified_id uuid;
  v_report_needs_review_id uuid;
  v_report_queued_id uuid;
  v_report_rejected_id uuid;
  v_report_draft_id uuid;

  v_analysis_job_verified_id uuid;
  v_analysis_job_needs_review_id uuid;

  v_prediction_verified_id uuid;
  v_prediction_needs_review_id uuid;

  v_task_id uuid;
begin
  -- ==========================================================================
  -- Demo auth users (local dev only — see file header note)
  -- ==========================================================================

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
  )
  values
    (v_reporter_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'reporter@mboyo.demo', crypt('DemoMboyo2026!', gen_salt('bf')),
     now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
    (v_verifier_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'verifier@mboyo.demo', crypt('DemoMboyo2026!', gen_salt('bf')),
     now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
    (v_coordinator_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'coordinator@mboyo.demo', crypt('DemoMboyo2026!', gen_salt('bf')),
     now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
    (v_admin_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'admin@mboyo.demo', crypt('DemoMboyo2026!', gen_salt('bf')),
     now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
    (v_auditor_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'auditor@mboyo.demo', crypt('DemoMboyo2026!', gen_salt('bf')),
     now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}');

  -- ==========================================================================
  -- Organization and disaster_event
  -- ==========================================================================

  insert into public.organizations (name)
  values ('PIDI Digdaya Demo')
  returning id into v_org_id;

  insert into public.disaster_events (organization_id, name, status, geofence, starts_at)
  values (
    v_org_id,
    'Banjir Jakarta Selatan — Demo',
    'active',
    -- A rough polygon around a South Jakarta area, WGS84, closed ring.
    st_geogfromtext('SRID=4326;POLYGON((106.79 -6.30, 106.85 -6.30, 106.85 -6.24, 106.79 -6.24, 106.79 -6.30))'),
    now() - interval '2 days'
  )
  returning id into v_event_id;

  -- ==========================================================================
  -- Profiles + role_assignments (all five roles)
  -- ==========================================================================

  insert into public.profiles (user_id, organization_id, display_name, phone)
  values (v_reporter_user_id, v_org_id, 'Siti Aminah (Pelapor Demo)', '+62811000001')
  returning id into v_reporter_profile_id;

  insert into public.profiles (user_id, organization_id, display_name, phone)
  values (v_verifier_user_id, v_org_id, 'Budi Raharjo (Verifikator Demo)', '+62811000002')
  returning id into v_verifier_profile_id;

  insert into public.profiles (user_id, organization_id, display_name, phone)
  values (v_coordinator_user_id, v_org_id, 'Dewi Lestari (Koordinator Demo)', '+62811000003')
  returning id into v_coordinator_profile_id;

  insert into public.profiles (user_id, organization_id, display_name, phone)
  values (v_admin_user_id, v_org_id, 'Agus Santoso (Admin Demo)', '+62811000004')
  returning id into v_admin_profile_id;

  insert into public.profiles (user_id, organization_id, display_name, phone)
  values (v_auditor_user_id, v_org_id, 'Rina Wijaya (Auditor Demo)', '+62811000005')
  returning id into v_auditor_profile_id;

  insert into public.role_assignments (profile_id, organization_id, role, granted_by)
  values
    (v_reporter_profile_id, v_org_id, 'reporter', v_admin_profile_id),
    (v_verifier_profile_id, v_org_id, 'verifier', v_admin_profile_id),
    (v_coordinator_profile_id, v_org_id, 'response_coordinator', v_admin_profile_id),
    (v_admin_profile_id, v_org_id, 'system_administrator', v_admin_profile_id),
    (v_auditor_profile_id, v_org_id, 'auditor', v_admin_profile_id);

  -- ==========================================================================
  -- Model registry: one promoted (passed release gate), one advisory-only
  -- candidate (release gate not yet passed) — per docs/product/SUCCESS_METRICS.md
  -- release gate / advisory-only fallback.
  -- ==========================================================================

  insert into public.model_registry_entries (version, artifact_path, trained_at, promoted_at, is_active)
  values ('mboyo-cv-v0.3.0', 'ml/models/mboyo-cv-v0.3.0.onnx', now() - interval '10 days', now() - interval '9 days', true)
  returning id into v_model_v1_id;

  insert into public.model_evaluations (
    model_registry_entry_id, dataset_identity, macro_f1, destroyed_recall, calibration_error, evaluated_at, report_path
  )
  values (
    v_model_v1_id, 'mboyo-eval-set-2026-07-01', 0.7420, 0.8100, 0.0650,
    now() - interval '9 days', 'ml/reports/mboyo-cv-v0.3.0-eval-2026-07-01.md'
  );

  insert into public.model_registry_entries (version, artifact_path, trained_at, promoted_at, is_active)
  values ('mboyo-cv-v0.4.0-rc1', 'ml/models/mboyo-cv-v0.4.0-rc1.onnx', now() - interval '1 day', null, false)
  returning id into v_model_v2_candidate_id;

  insert into public.model_evaluations (
    model_registry_entry_id, dataset_identity, macro_f1, destroyed_recall, calibration_error, evaluated_at, report_path
  )
  values (
    -- Deliberately below a plausible release-gate threshold on
    -- destroyed_recall, illustrating the advisory-only fallback path.
    v_model_v2_candidate_id, 'mboyo-eval-set-2026-07-01', 0.7610, 0.6200, 0.1100,
    now() - interval '1 day', 'ml/reports/mboyo-cv-v0.4.0-rc1-eval-2026-07-15.md'
  );

  -- ==========================================================================
  -- Reports spanning a representative spread of report_status
  -- ==========================================================================

  -- 1. Verified report (full pipeline: submitted -> analyzed -> verified)
  insert into public.reports (
    client_report_id, reporter_profile_id, disaster_event_id, status, description,
    created_at_client, submitted_at
  )
  values (
    gen_random_uuid(), v_reporter_profile_id, v_event_id, 'verified',
    'Rumah warga di RW 04 roboh sebagian akibat banjir bandang.',
    now() - interval '6 hours', now() - interval '6 hours'
  )
  returning id into v_report_verified_id;

  insert into public.report_evidence (report_id, storage_path, mime_type, size_bytes, sha256_hash, perceptual_hash)
  values (
    v_report_verified_id, 'report-evidence/demo/verified-report-1.jpg', 'image/jpeg', 482913,
    encode(digest('demo-verified-report-1', 'sha256'), 'hex'),
    'a1b2c3d4e5f60718'
  );

  insert into public.geolocation_observations (report_id, location, accuracy_meters, captured_at_client, confidence_signal)
  values (
    v_report_verified_id,
    st_geogfromtext('SRID=4326;POINT(106.822 -6.261)'),
    8.5, now() - interval '6 hours', 0.910
  );

  insert into public.analysis_jobs (report_id, status, claimed_by, claimed_at, attempts, model_registry_entry_id, completed_at)
  values (
    v_report_verified_id, 'done', 'worker-demo-1', now() - interval '5 hours 55 minutes', 1, v_model_v1_id,
    now() - interval '5 hours 50 minutes'
  )
  returning id into v_analysis_job_verified_id;

  insert into public.model_predictions (
    analysis_job_id, report_id, severity_probabilities, quality_score, is_advisory_only
  )
  values (
    v_analysis_job_verified_id, v_report_verified_id,
    jsonb_build_object(
      'unknown', 0.02, 'no_damage', 0.03, 'minor_damage', 0.10, 'major_damage', 0.55, 'destroyed', 0.30
    ),
    0.870, false
  )
  returning id into v_prediction_verified_id;

  insert into public.model_explanations (model_prediction_id, explanation_type, payload)
  values (
    v_prediction_verified_id, 'saliency_region',
    jsonb_build_object('region', 'lower-left quadrant', 'note', 'Struktur atap dan dinding menunjukkan keruntuhan parsial.')
  );

  insert into public.verification_reviews (report_id, verifier_profile_id, decision, notes, decided_at)
  values (
    v_report_verified_id, v_verifier_profile_id, 'confirm',
    'Bukti foto dan lokasi konsisten dengan laporan warga lain di area yang sama.',
    now() - interval '5 hours'
  );

  -- 2. Needs-manual-review report (advisory-only model output)
  insert into public.reports (
    client_report_id, reporter_profile_id, disaster_event_id, status, description,
    created_at_client, submitted_at
  )
  values (
    gen_random_uuid(), v_reporter_profile_id, v_event_id, 'needs_manual_review',
    'Jalan retak dan sebagian tergenang di dekat pasar.',
    now() - interval '3 hours', now() - interval '3 hours'
  )
  returning id into v_report_needs_review_id;

  insert into public.report_evidence (report_id, storage_path, mime_type, size_bytes, sha256_hash, perceptual_hash)
  values (
    v_report_needs_review_id, 'report-evidence/demo/needs-review-report-2.jpg', 'image/jpeg', 391022,
    encode(digest('demo-needs-review-report-2', 'sha256'), 'hex'),
    'b2c3d4e5f6071829'
  );

  insert into public.geolocation_observations (report_id, location, accuracy_meters, captured_at_client, confidence_signal)
  values (
    v_report_needs_review_id,
    st_geogfromtext('SRID=4326;POINT(106.831 -6.267)'),
    22.0, now() - interval '3 hours', 0.480
  );

  insert into public.analysis_jobs (report_id, status, claimed_by, claimed_at, attempts, model_registry_entry_id, completed_at)
  values (
    v_report_needs_review_id, 'done', 'worker-demo-1', now() - interval '2 hours 55 minutes', 1, v_model_v2_candidate_id,
    now() - interval '2 hours 50 minutes'
  )
  returning id into v_analysis_job_needs_review_id;

  insert into public.model_predictions (
    analysis_job_id, report_id, severity_probabilities, quality_score, is_advisory_only
  )
  values (
    v_analysis_job_needs_review_id, v_report_needs_review_id,
    jsonb_build_object(
      'unknown', 0.15, 'no_damage', 0.20, 'minor_damage', 0.35, 'major_damage', 0.22, 'destroyed', 0.08
    ),
    0.410, true
  )
  returning id into v_prediction_needs_review_id;

  -- 3. Still-queued-offline report (never reached the server yet — a
  -- realistic pre-sync state for the Reporter's own Antrean Offline view;
  -- represented here at the server layer only for demo completeness, since
  -- true queued_offline state normally exists only in client IndexedDB).
  insert into public.reports (
    client_report_id, reporter_profile_id, disaster_event_id, status, description, created_at_client
  )
  values (
    gen_random_uuid(), v_reporter_profile_id, v_event_id, 'queued_offline',
    'Pohon tumbang menutup akses jalan utama.',
    now() - interval '30 minutes'
  )
  returning id into v_report_queued_id;

  -- 4. Rejected report (duplicate of the verified one)
  insert into public.reports (
    client_report_id, reporter_profile_id, disaster_event_id, status, description,
    created_at_client, submitted_at
  )
  values (
    gen_random_uuid(), v_reporter_profile_id, v_event_id, 'rejected',
    'Laporan duplikat dari rumah warga RW 04.',
    now() - interval '5 hours 30 minutes', now() - interval '5 hours 30 minutes'
  )
  returning id into v_report_rejected_id;

  insert into public.verification_reviews (report_id, verifier_profile_id, decision, notes, decided_at)
  values (
    v_report_rejected_id, v_verifier_profile_id, 'reject',
    'Duplikat dari laporan yang sudah terverifikasi pada lokasi yang sama.',
    now() - interval '5 hours 15 minutes'
  );

  -- 5. Draft-local report (local-only in reality; included here only so
  -- Auditor/Verifier screens have a full status spread to render against).
  insert into public.reports (
    client_report_id, reporter_profile_id, disaster_event_id, status, description, created_at_client
  )
  values (
    gen_random_uuid(), v_reporter_profile_id, v_event_id, 'draft_local',
    'Draf laporan belum dikirim.',
    now() - interval '10 minutes'
  )
  returning id into v_report_draft_id;

  -- ==========================================================================
  -- Response task for the verified report
  -- ==========================================================================

  insert into public.response_tasks (report_id, status, priority, created_by_profile_id)
  values (v_report_verified_id, 'assigned', 'high', v_coordinator_profile_id)
  returning id into v_task_id;

  insert into public.task_assignments (response_task_id, assignee_profile_id, assigned_by_profile_id)
  values (v_task_id, v_coordinator_profile_id, v_coordinator_profile_id);

  -- ==========================================================================
  -- Notifications
  -- ==========================================================================

  insert into public.notifications (recipient_profile_id, type, payload, read_at)
  values
    (v_verifier_profile_id, 'queue_item_new',
     jsonb_build_object('report_id', v_report_needs_review_id, 'message', 'Laporan baru memerlukan tinjauan manual.'),
     null),
    (v_coordinator_profile_id, 'incident_verified',
     jsonb_build_object('report_id', v_report_verified_id, 'message', 'Insiden baru terverifikasi dan siap ditugaskan.'),
     now() - interval '4 hours 50 minutes');

  -- ==========================================================================
  -- Audit events — full lineage for the verified report, via the sanctioned
  -- append_audit_event() write path (see the RPC functions migration).
  -- ==========================================================================

  perform public.append_audit_event(
    'report', v_report_verified_id, 'report.created',
    jsonb_build_object('reporter_profile_id', v_reporter_profile_id, 'disaster_event_id', v_event_id)
  );
  perform public.append_audit_event(
    'analysis_job', v_analysis_job_verified_id, 'analysis_job.completed',
    jsonb_build_object('model_registry_entry_id', v_model_v1_id, 'is_advisory_only', false)
  );
  perform public.append_audit_event(
    'report', v_report_verified_id, 'report.verified',
    jsonb_build_object('verifier_profile_id', v_verifier_profile_id, 'decision', 'confirm')
  );
  perform public.append_audit_event(
    'response_task', v_task_id, 'response_task.created',
    jsonb_build_object('coordinator_profile_id', v_coordinator_profile_id, 'report_id', v_report_verified_id, 'priority', 'high')
  );
  perform public.append_audit_event(
    'response_task', v_task_id, 'response_task.assigned',
    jsonb_build_object('coordinator_profile_id', v_coordinator_profile_id, 'assignee_profile_id', v_coordinator_profile_id)
  );

  -- ==========================================================================
  -- System settings (a couple of representative demo values)
  -- ==========================================================================

  insert into public.system_settings (organization_id, key, value, updated_by_profile_id)
  values
    (v_org_id, 'manual_review_quality_threshold', '0.5'::jsonb, v_admin_profile_id),
    (v_org_id, 'retention_days_report_evidence', '180'::jsonb, v_admin_profile_id);

end $$;
