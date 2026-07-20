-- BLOCK 23 — schema additions for the Verifier decision workflow:
--   1. A new verification_decision value, 'insufficient_evidence' — distinct
--      from 'request_info' (which asks the Reporter a specific question):
--      this flags that the evidence itself (photo quality/count) cannot
--      support any decision at all, useful as its own audit-trail category
--      and queue filter.
--   2. verification_reviews.reject_reason_category — a structured reason
--      alongside the existing free-text notes field, required iff
--      decision='reject' (mirroring override_severity's existing
--      required-iff-override constraint pattern exactly).
--   3. verification_reviews.supersedes_review_id — an explicit link from a
--      later review to the one it supersedes, so "immutable review history
--      + superseding review instead of destructive editing" is a real,
--      queryable relationship, not just an insertion-order assumption.
--      verification_reviews itself remains insert-only (no U/D policy for
--      any role, unchanged from BLOCK 08) — this column records intent,
--      it does not itself permit any mutation.
--   4. reports.escalated — a cheap, indexable boolean the queue can filter/
--      sort on directly, set true by submit_verification_decision() on an
--      'escalate' decision and cleared by any subsequent confirm/override/
--      reject/insufficient_evidence decision that resolves the report.
--
-- ALTER TYPE ... ADD VALUE cannot run in the same transaction as code that
-- references the new value (a well-known Postgres restriction — the new
-- enum label isn't visible to the current transaction yet) — this
-- migration only adds the enum value and the new columns; the RPC that
-- actually uses 'insufficient_evidence' is replaced in the next migration.

alter type public.verification_decision add value 'insufficient_evidence';

create type public.verification_reject_reason as enum (
  'insufficient_evidence',
  'not_disaster_related',
  'duplicate_report',
  'fraudulent_or_spam',
  'outside_event_boundary',
  'other'
);

alter table public.verification_reviews
  add column reject_reason_category public.verification_reject_reason,
  add column supersedes_review_id uuid references public.verification_reviews (id) on delete set null;

-- A review cannot supersede itself, and the constraint below is enforced
-- alongside override_severity's existing one so both structured-field
-- rules live in one place.
alter table public.verification_reviews
  add constraint verification_reviews_reject_reason_requires_reject check (
    (decision = 'reject' and reject_reason_category is not null)
    or (decision <> 'reject' and reject_reason_category is null)
  ),
  add constraint verification_reviews_supersedes_not_self check (
    supersedes_review_id is null or supersedes_review_id <> id
  );

create index verification_reviews_supersedes_review_id_idx
  on public.verification_reviews (supersedes_review_id)
  where supersedes_review_id is not null;

alter table public.reports
  add column escalated boolean not null default false;

create index reports_escalated_idx on public.reports (escalated) where escalated;

comment on column public.verification_reviews.reject_reason_category is
  'Structured reject reason, required iff decision=reject — distinct from the free-text notes field, per BLOCK 23''s "reason category/note" requirement.';
comment on column public.verification_reviews.supersedes_review_id is
  'Explicit link to the verification_review this one supersedes (e.g. a correction after request_info, or a second look after escalation) — verification_reviews remains insert-only; this column records intent, not permission to mutate.';
comment on column public.reports.escalated is
  'True while a report has an unresolved escalate decision — set by submit_verification_decision() on escalate, cleared by any subsequent confirm/override/reject/insufficient_evidence on the same report. Backs the Antrean Verifikasi queue''s escalation filter/sort per docs/product/SCREEN_INVENTORY.md.';
