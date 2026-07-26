-- MBOYO core domain schema.
--
-- Implements the 22 entities in docs/product/DOMAIN_MODEL.md and the state
-- machines in docs/product/STATE_MACHINES.md. RLS policies are added in a
-- later migration (20260716153711_rls_policies.sql) so schema and access
-- control are reviewable independently; this migration alone grants no
-- access (RLS defaults to deny-all once enabled per-table below).
--
-- All tables use UUID primary keys (gen_random_uuid(), pgcrypto — bundled
-- with the Supabase postgres image) and created_at/updated_at timestamps
-- where the entity is ever updated after creation.

create extension if not exists pgcrypto;

-- Cloud projects don't always default this migration role's session
-- search_path to include `extensions` the way local Supabase's bootstrap
-- does — without this, every unqualified `geography`/`geometry` column
-- type reference below fails with "type does not exist" (PostGIS types
-- live in extensions, not public). Local dev is unaffected since it
-- already has this on the role.
set search_path = public, extensions;

-- ============================================================================
-- ENUMS
-- ============================================================================

create type public.app_role as enum (
  'reporter',
  'verifier',
  'response_coordinator',
  'system_administrator',
  'auditor'
);

create type public.report_status as enum (
  'draft_local',
  'queued_offline',
  'syncing',
  'submitted',
  'evidence_uploaded',
  'analysis_queued',
  'analysis_running',
  'analysis_completed',
  'needs_manual_review',
  'verified',
  'rejected',
  'archived'
);

create type public.severity_class as enum (
  'unknown',
  'no_damage',
  'minor_damage',
  'major_damage',
  'destroyed'
);

create type public.priority_level as enum (
  'unassigned',
  'low',
  'medium',
  'high',
  'critical'
);

create type public.verification_decision as enum (
  'confirm',
  'override',
  'reject',
  'request_info',
  'escalate'
);

create type public.task_status as enum (
  'draft',
  'assigned',
  'acknowledged',
  'in_progress',
  'blocked',
  'completed',
  'cancelled'
);

create type public.analysis_job_status as enum (
  'queued',
  'processing',
  'done',
  'failed'
);

create type public.disaster_event_status as enum (
  'active',
  'closed'
);

create type public.export_job_status as enum (
  'queued',
  'processing',
  'done',
  'failed'
);

-- ============================================================================
-- organization / profile / role_assignment
-- ============================================================================

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- One profile per Supabase Auth user, per docs/product/DOMAIN_MODEL.md —
-- kept separate from auth.users so the domain can carry additional fields
-- without touching the auth schema.
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete restrict,
  display_name text not null,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- role_assignment is a separate join entity (not a single role column on
-- profiles) per docs/product/DOMAIN_MODEL.md, since RLS policies key off
-- this table rather than a client-supplied claim, and a profile may hold
-- more than one role.
create table public.role_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);

-- A profile cannot hold the same active (non-revoked) role twice.
create unique index role_assignments_active_unique_idx
  on public.role_assignments (profile_id, role)
  where revoked_at is null;

-- ============================================================================
-- disaster_event
-- ============================================================================

create table public.disaster_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  status public.disaster_event_status not null default 'active',
  -- Geofence for the GPS-confidence cross-check in docs/security/THREAT_MODEL.md
  -- threat #3. SRID 4326 (WGS84) matches the geography type used throughout.
  geofence geography(Polygon, 4326),
  starts_at timestamptz not null default now(),
  ends_at timestamptz
);

-- ============================================================================
-- report / report_evidence / geolocation_observation
-- ============================================================================

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  -- Client-generated dedupe key (see docs/adr/0005-offline-indexeddb-workbox.md)
  -- created at report-creation time on-device, not at sync time — this is
  -- what makes the sync upsert idempotent against Background Sync retries.
  client_report_id uuid not null,
  reporter_profile_id uuid not null references public.profiles (id) on delete restrict,
  disaster_event_id uuid not null references public.disaster_events (id) on delete restrict,
  status public.report_status not null default 'draft_local',
  description text,
  created_at_client timestamptz,
  submitted_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The dedupe key is unique per reporter (not globally) so two different
-- reporters' client-generated UUIDs can never collide in a way that would
-- cross-attribute a report — client_report_id uniqueness is scoped to its
-- owning reporter.
create unique index reports_client_report_id_unique_idx
  on public.reports (reporter_profile_id, client_report_id);

create table public.report_evidence (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  -- SHA-256 of the original file, for integrity verification and exact
  -- duplicate-file detection (distinct from perceptual similarity below).
  sha256_hash text not null check (char_length(sha256_hash) = 64),
  -- Perceptual hash (e.g. pHash/aHash, 64-bit hex) for near-duplicate image
  -- detection feeding the Verifier's duplicate signal per
  -- docs/product/DOMAIN_MODEL.md model_prediction.duplicate_candidate_report_id.
  perceptual_hash text,
  uploaded_at timestamptz not null default now()
);

create index report_evidence_report_id_idx on public.report_evidence (report_id);
create index report_evidence_perceptual_hash_idx on public.report_evidence (perceptual_hash);

create table public.geolocation_observations (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  -- geography(Point, 4326): WGS84 lon/lat, matching GPS coordinate output
  -- directly — no manual axis-order handling needed at the application layer.
  location geography(Point, 4326) not null,
  accuracy_meters numeric(10, 2),
  captured_at_client timestamptz,
  -- Computed server-side/by apps/worker per docs/product/DOMAIN_MODEL.md —
  -- nullable until computed, then 0..1.
  confidence_signal numeric(4, 3) check (confidence_signal is null or (confidence_signal >= 0 and confidence_signal <= 1)),
  created_at timestamptz not null default now()
);

-- GIST index is the standard PostGIS index type for geography/geometry
-- columns — required for reports_in_bbox/reports_within_radius (see the
-- functions migration) to run as index scans rather than sequential scans.
create index geolocation_observations_location_gist_idx
  on public.geolocation_observations using gist (location);

create index geolocation_observations_report_id_idx
  on public.geolocation_observations (report_id);

-- ============================================================================
-- model_registry_entry / model_evaluation
-- ============================================================================
-- Created before analysis_job/model_prediction since those reference
-- model_registry_entries.

create table public.model_registry_entries (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  artifact_path text not null,
  trained_at timestamptz not null,
  promoted_at timestamptz,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

-- Only one model_registry_entry may be the active/serving version at a time.
create unique index model_registry_entries_single_active_idx
  on public.model_registry_entries ((is_active))
  where is_active;

create table public.model_evaluations (
  id uuid primary key default gen_random_uuid(),
  model_registry_entry_id uuid not null references public.model_registry_entries (id) on delete cascade,
  dataset_identity text not null,
  -- Macro-F1, destroyed recall, calibration error per the release gate in
  -- docs/product/SUCCESS_METRICS.md — all measured metrics, never
  -- guessed/placeholder, hence NOT NULL with a bounded check constraint
  -- rather than a nullable "TBD" field.
  macro_f1 numeric(5, 4) not null check (macro_f1 >= 0 and macro_f1 <= 1),
  destroyed_recall numeric(5, 4) not null check (destroyed_recall >= 0 and destroyed_recall <= 1),
  calibration_error numeric(5, 4) not null check (calibration_error >= 0 and calibration_error <= 1),
  evaluated_at timestamptz not null,
  report_path text not null,
  created_at timestamptz not null default now()
);

create index model_evaluations_model_registry_entry_id_idx
  on public.model_evaluations (model_registry_entry_id);

-- ============================================================================
-- analysis_job / model_prediction / model_explanation
-- ============================================================================

create table public.analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  status public.analysis_job_status not null default 'queued',
  claimed_by text,
  claimed_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  model_registry_entry_id uuid references public.model_registry_entries (id) on delete set null,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Partial index over queued jobs is the "queue index" — the claim function
-- (see the functions migration) scans exactly this index via
-- `WHERE status = 'queued' ORDER BY created_at LIMIT n FOR UPDATE SKIP LOCKED`.
create index analysis_jobs_queued_idx
  on public.analysis_jobs (created_at)
  where status = 'queued';

create index analysis_jobs_report_id_idx on public.analysis_jobs (report_id);
create index analysis_jobs_status_idx on public.analysis_jobs (status);

create table public.model_predictions (
  id uuid primary key default gen_random_uuid(),
  analysis_job_id uuid not null unique references public.analysis_jobs (id) on delete cascade,
  report_id uuid not null references public.reports (id) on delete cascade,
  -- Per-class probabilities keyed by severity_class, e.g.
  -- {"unknown": 0.02, "no_damage": 0.05, ...}. Stored as jsonb (not five
  -- separate numeric columns) so the class set can evolve without a
  -- migration, while the check constraint below still enforces the
  -- probabilistic-sum invariant.
  severity_probabilities jsonb not null,
  quality_score numeric(4, 3) not null check (quality_score >= 0 and quality_score <= 1),
  duplicate_candidate_report_id uuid references public.reports (id) on delete set null,
  is_advisory_only boolean not null default false,
  created_at timestamptz not null default now(),
  constraint model_predictions_probabilities_are_valid check (
    severity_probabilities ?& array['unknown', 'no_damage', 'minor_damage', 'major_damage', 'destroyed']
    and (severity_probabilities->>'unknown')::numeric between 0 and 1
    and (severity_probabilities->>'no_damage')::numeric between 0 and 1
    and (severity_probabilities->>'minor_damage')::numeric between 0 and 1
    and (severity_probabilities->>'major_damage')::numeric between 0 and 1
    and (severity_probabilities->>'destroyed')::numeric between 0 and 1
    -- Probabilities across the 5 severity classes must sum to ~1 (small
    -- tolerance for floating-point serialization), per
    -- docs/product/SUCCESS_METRICS.md ML honesty rules — a malformed or
    -- fabricated probability vector is rejected at the database layer, not
    -- just trusted from apps/worker.
    and abs(
      (severity_probabilities->>'unknown')::numeric
      + (severity_probabilities->>'no_damage')::numeric
      + (severity_probabilities->>'minor_damage')::numeric
      + (severity_probabilities->>'major_damage')::numeric
      + (severity_probabilities->>'destroyed')::numeric
      - 1
    ) < 0.01
  )
);

create index model_predictions_report_id_idx on public.model_predictions (report_id);
create index model_predictions_duplicate_candidate_idx
  on public.model_predictions (duplicate_candidate_report_id)
  where duplicate_candidate_report_id is not null;

create table public.model_explanations (
  id uuid primary key default gen_random_uuid(),
  model_prediction_id uuid not null references public.model_predictions (id) on delete cascade,
  explanation_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index model_explanations_model_prediction_id_idx
  on public.model_explanations (model_prediction_id);

-- ============================================================================
-- verification_review
-- ============================================================================

create table public.verification_reviews (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  verifier_profile_id uuid not null references public.profiles (id) on delete restrict,
  decision public.verification_decision not null,
  override_severity public.severity_class,
  notes text,
  decided_at timestamptz not null default now(),
  constraint verification_reviews_override_severity_requires_override check (
    (decision = 'override' and override_severity is not null)
    or (decision <> 'override' and override_severity is null)
  )
);

create index verification_reviews_report_id_idx on public.verification_reviews (report_id);
create index verification_reviews_verifier_profile_id_idx on public.verification_reviews (verifier_profile_id);

-- ============================================================================
-- incident_cluster / cluster_member
-- ============================================================================

create table public.incident_clusters (
  id uuid primary key default gen_random_uuid(),
  disaster_event_id uuid not null references public.disaster_events (id) on delete cascade,
  label text not null,
  priority public.priority_level not null default 'unassigned',
  created_by_profile_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index incident_clusters_disaster_event_id_idx on public.incident_clusters (disaster_event_id);

create table public.cluster_members (
  id uuid primary key default gen_random_uuid(),
  incident_cluster_id uuid not null references public.incident_clusters (id) on delete cascade,
  report_id uuid not null references public.reports (id) on delete cascade,
  added_at timestamptz not null default now()
);

-- A report belongs to at most one cluster at a time, matching the 1:1
-- relationship documented in docs/product/DOMAIN_MODEL.md's relationship summary.
create unique index cluster_members_report_id_unique_idx on public.cluster_members (report_id);
create index cluster_members_incident_cluster_id_idx on public.cluster_members (incident_cluster_id);

-- ============================================================================
-- response_task / task_assignment
-- ============================================================================

create table public.response_tasks (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.reports (id) on delete restrict,
  incident_cluster_id uuid references public.incident_clusters (id) on delete restrict,
  status public.task_status not null default 'draft',
  priority public.priority_level not null default 'unassigned',
  created_by_profile_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint response_tasks_exactly_one_target check (
    (report_id is not null and incident_cluster_id is null)
    or (report_id is null and incident_cluster_id is not null)
  )
);

create index response_tasks_report_id_idx on public.response_tasks (report_id);
create index response_tasks_incident_cluster_id_idx on public.response_tasks (incident_cluster_id);
create index response_tasks_status_idx on public.response_tasks (status);

create table public.task_assignments (
  id uuid primary key default gen_random_uuid(),
  response_task_id uuid not null references public.response_tasks (id) on delete cascade,
  assignee_profile_id uuid not null references public.profiles (id) on delete restrict,
  assigned_by_profile_id uuid not null references public.profiles (id) on delete restrict,
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz
);

create index task_assignments_response_task_id_idx on public.task_assignments (response_task_id);
create index task_assignments_assignee_profile_id_idx on public.task_assignments (assignee_profile_id);

-- ============================================================================
-- notification / push_subscription
-- ============================================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_profile_id_idx on public.notifications (recipient_profile_id);
create index notifications_recipient_unread_idx
  on public.notifications (recipient_profile_id)
  where read_at is null;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null,
  keys jsonb not null,
  created_at timestamptz not null default now()
);

create unique index push_subscriptions_profile_endpoint_unique_idx
  on public.push_subscriptions (profile_id, endpoint);

-- ============================================================================
-- export_job
-- ============================================================================

create table public.export_jobs (
  id uuid primary key default gen_random_uuid(),
  requested_by_profile_id uuid not null references public.profiles (id) on delete restrict,
  disaster_event_id uuid not null references public.disaster_events (id) on delete restrict,
  format text not null check (format in ('csv', 'geojson')),
  filter_criteria jsonb not null default '{}'::jsonb,
  status public.export_job_status not null default 'queued',
  storage_path text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index export_jobs_requested_by_profile_id_idx on public.export_jobs (requested_by_profile_id);
create index export_jobs_disaster_event_id_idx on public.export_jobs (disaster_event_id);

-- ============================================================================
-- audit_event
-- ============================================================================
-- Append-only per docs/security/THREAT_MODEL.md threat #12 — no UPDATE/DELETE
-- grants to any role are ever issued on this table (enforced via RLS in the
-- next migration and via REVOKE below as defense in depth at the SQL grant
-- level, not just RLS policy level).

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  actor_profile_id uuid references public.profiles (id) on delete set null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index audit_events_entity_idx on public.audit_events (entity_type, entity_id);
create index audit_events_occurred_at_idx on public.audit_events (occurred_at);
create index audit_events_actor_profile_id_idx on public.audit_events (actor_profile_id);

-- ============================================================================
-- system_setting
-- ============================================================================

create table public.system_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_by_profile_id uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create unique index system_settings_org_key_unique_idx
  on public.system_settings (organization_id, key);

-- ============================================================================
-- updated_at maintenance
-- ============================================================================

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger reports_set_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();
