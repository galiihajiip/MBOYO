-- BLOCK 22 — gemini_advisory_requests: an optional, non-authoritative
-- external advisory call a Verifier may trigger while reviewing a report,
-- per docs/adr/0004-local-ml-primary-gemini-advisory.md. This is a
-- complete audit record of the call (never chain-of-thought — only the
-- final structured output, per this block's explicit requirement), never
-- a decision record: creating a row here has NO effect on
-- reports.status or verification_reviews, enforced structurally (this
-- table has no trigger or function that touches either).

create type public.gemini_advisory_status as enum (
  'succeeded',
  'failed',
  'timed_out',
  'rate_limited'
);

create type public.gemini_image_disclosure_level as enum (
  -- No image data sent at all — only derived, non-visual metadata
  -- (quality score, dimensions, severity probabilities, description text).
  'none',
  -- A redacted/downscaled derivative was sent, never the original file.
  'redacted_image',
  -- The original evidence image was sent, only ever when explicitly
  -- requested by the Verifier and consent/policy/disclosure were accepted
  -- (all three enforced in application code before this RPC is called —
  -- see apps/web/src/lib/reports/service/gemini-advisory.ts).
  'raw_image'
);

create table public.gemini_advisory_requests (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  verifier_profile_id uuid not null references public.profiles (id) on delete restrict,
  status public.gemini_advisory_status not null,
  image_disclosure_level public.gemini_image_disclosure_level not null default 'none',
  -- Explicit, auditable proof that both required acknowledgements were
  -- given at the time of this specific request — never inferred from a
  -- session flag or assumed from a prior request.
  consent_accepted boolean not null,
  external_disclosure_accepted boolean not null,
  -- Structured output only (evidence_summary, suggested_follow_up_question,
  -- hypothesis, quality_observations — see packages/domain/src/gemini-advisory.ts
  -- for the exact shape) — never free-form chain-of-thought reasoning,
  -- which this column structurally cannot hold since only fields the
  -- response schema defines are ever written here.
  structured_output jsonb,
  error_message text,
  model_name text not null,
  request_id text not null,
  latency_ms integer not null check (latency_ms >= 0),
  retry_count integer not null default 0 check (retry_count >= 0),
  estimated_cost_usd numeric(10, 6),
  created_at timestamptz not null default now(),
  constraint gemini_advisory_requests_succeeded_has_output check (
    (status = 'succeeded' and structured_output is not null)
    or (status <> 'succeeded' and structured_output is null)
  ),
  constraint gemini_advisory_requests_failure_has_message check (
    (status <> 'succeeded' and error_message is not null)
    or (status = 'succeeded' and error_message is null)
  )
);

create index gemini_advisory_requests_report_id_idx on public.gemini_advisory_requests (report_id);
create index gemini_advisory_requests_verifier_profile_id_idx on public.gemini_advisory_requests (verifier_profile_id);

comment on table public.gemini_advisory_requests is
  'Complete audit trail of every Gemini advisory call a Verifier triggers — structured output only, never chain-of-thought. Immutable once created (no U/D policy for any role). Creating a row never changes reports.status or creates a verification_review; those remain exclusively the Verifier''s own decision, per docs/adr/0004-local-ml-primary-gemini-advisory.md.';

-- ============================================================================
-- RLS — no direct table-level INSERT policy for any role: the only write
-- path is record_gemini_advisory_request() below (SECURITY DEFINER),
-- mirroring submit_verification_decision()'s pattern exactly, so the actor
-- is always resolved server-side via current_profile_id() and never
-- trusted from client input. Verifier: R. Auditor: R (read-only, so a
-- prompt/response can be reviewed after the fact per
-- docs/security/THREAT_MODEL.md's Gemini-prompt-injection detection
-- strategy). No role ever gets U/D — immutable once created, matching
-- verification_reviews' own "a correction is a new row" precedent.
-- ============================================================================

alter table public.gemini_advisory_requests enable row level security;
alter table public.gemini_advisory_requests force row level security;

create policy gemini_advisory_requests_verifier_select on public.gemini_advisory_requests
  for select
  using (public.has_role('verifier'));

create policy gemini_advisory_requests_auditor_select on public.gemini_advisory_requests
  for select
  using (public.has_role('auditor'));

-- ============================================================================
-- record_gemini_advisory_request — the sole write path, mirroring
-- submit_verification_decision()'s exact shape (role check,
-- current_profile_id() actor resolution, insert, return the row) so this
-- Verifier-authored write is structurally consistent with every other one
-- in this codebase, not a special case. Deliberately does NOT touch
-- reports.status or verification_reviews — see the table comment above.
-- ============================================================================

create function public.record_gemini_advisory_request(
  p_report_id uuid,
  p_status public.gemini_advisory_status,
  p_image_disclosure_level public.gemini_image_disclosure_level,
  p_consent_accepted boolean,
  p_external_disclosure_accepted boolean,
  p_structured_output jsonb,
  p_error_message text,
  p_model_name text,
  p_request_id text,
  p_latency_ms integer,
  p_retry_count integer default 0,
  p_estimated_cost_usd numeric default null
)
returns public.gemini_advisory_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid;
  v_row public.gemini_advisory_requests;
begin
  if not public.has_role('verifier') then
    raise exception 'record_gemini_advisory_request: caller must hold the verifier role' using errcode = '42501';
  end if;

  v_actor_profile_id := public.current_profile_id();
  if v_actor_profile_id is null then
    raise exception 'record_gemini_advisory_request: no profile for calling user' using errcode = '42501';
  end if;

  if not exists (select 1 from public.reports where id = p_report_id) then
    raise exception 'record_gemini_advisory_request: report % not found', p_report_id using errcode = 'P0002';
  end if;

  -- Defense-in-depth (application code already enforces this before
  -- calling this function): a raw_image disclosure level is only ever
  -- valid alongside both acknowledgements — never silently downgraded or
  -- permitted without them.
  if p_image_disclosure_level = 'raw_image' and not (p_consent_accepted and p_external_disclosure_accepted) then
    raise exception 'record_gemini_advisory_request: raw_image disclosure requires both consent_accepted and external_disclosure_accepted' using errcode = '22023';
  end if;

  insert into public.gemini_advisory_requests (
    report_id, verifier_profile_id, status, image_disclosure_level,
    consent_accepted, external_disclosure_accepted, structured_output,
    error_message, model_name, request_id, latency_ms, retry_count,
    estimated_cost_usd
  )
  values (
    p_report_id, v_actor_profile_id, p_status, p_image_disclosure_level,
    p_consent_accepted, p_external_disclosure_accepted, p_structured_output,
    p_error_message, p_model_name, p_request_id, p_latency_ms, p_retry_count,
    p_estimated_cost_usd
  )
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.record_gemini_advisory_request(uuid, public.gemini_advisory_status, public.gemini_image_disclosure_level, boolean, boolean, jsonb, text, text, text, integer, integer, numeric) is
  'The sole write path for gemini_advisory_requests — resolves the acting Verifier server-side via current_profile_id(), never a client-passed profile id. Never changes reports.status or verification_reviews.';

grant execute on function public.record_gemini_advisory_request(uuid, public.gemini_advisory_status, public.gemini_image_disclosure_level, boolean, boolean, jsonb, text, text, text, integer, integer, numeric) to authenticated;
