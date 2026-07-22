-- BLOCK 26 — Verifier analytics: review count, agreement/override rate,
-- review time, queue age, quality distribution. Two views:
-- verifier_review_analytics (per-review facts: review time, agreement/
-- override classification) is the raw per-row surface the TypeScript
-- service aggregates (counts, rates, percentile/bucket distributions) over
-- — matching this codebase's established "aggregate in TypeScript over a
-- small already-fetched result set" precedent (BLOCK 23's
-- information-requests.ts, BLOCK 24's analytics.ts) rather than a single
-- opaque summary row, since distributions (queue age buckets, quality
-- buckets) need the individual rows, not just a mean.

create view public.verifier_review_analytics
with (security_invoker = true)
as
select
  vr.id as review_id,
  vr.report_id,
  vr.verifier_profile_id,
  vr.decision,
  vr.override_severity,
  vr.decided_at,
  r.submitted_at,
  -- Review time in seconds — null if the report has no submitted_at
  -- (shouldn't happen for a report that reached a decision, but defensive
  -- rather than assumed).
  case when r.submitted_at is not null
    then extract(epoch from (vr.decided_at - r.submitted_at))
    else null
  end as review_time_seconds,
  latest_prediction.top_severity as model_top_severity,
  latest_prediction.quality_score,
  -- Agreement: the Verifier's confirm decision (or an override that
  -- happens to land on the same class the model already predicted) means
  -- the model's top class was accepted as final. Override: decision is
  -- 'override' and override_severity differs from the model's own top
  -- class — the Verifier explicitly corrected the model. Neither: any
  -- other decision (reject/escalate/request_info/insufficient_evidence),
  -- which isn't a severity agreement/disagreement judgment at all.
  case
    when vr.decision = 'confirm' then 'agreement'
    when vr.decision = 'override' and vr.override_severity = latest_prediction.top_severity then 'agreement'
    when vr.decision = 'override' and vr.override_severity is distinct from latest_prediction.top_severity then 'override'
    else 'other'
  end as agreement_classification
from public.verification_reviews vr
join public.reports r on r.id = vr.report_id
left join lateral (
  select
    (
      select key
      from jsonb_each_text(mp.severity_probabilities) as kv(key, value)
      order by value::numeric desc
      limit 1
    ) as top_severity,
    mp.quality_score
  from public.model_predictions mp
  where mp.report_id = vr.report_id
  order by mp.created_at desc
  limit 1
) as latest_prediction on true;

grant select on public.verifier_review_analytics to authenticated;

comment on view public.verifier_review_analytics is
  'One row per verification_reviews decision, with review time and model-agreement classification — the Verifier Analitik screen (BLOCK 26) aggregates over this (counts, rates, distributions) in TypeScript. security_invoker: RLS on verification_reviews/reports/model_predictions still governs visibility exactly as it does today.';

-- ============================================================================
-- verifier_queue_age — one row per still-open queue report with its age in
-- seconds, for the queue-age distribution. Distinct from
-- verifier_review_analytics (which is about COMPLETED reviews) — this is
-- about reports STILL WAITING for one.
-- ============================================================================

create view public.verifier_queue_age
with (security_invoker = true)
as
select
  r.id as report_id,
  r.submitted_at,
  extract(epoch from (now() - r.submitted_at)) as age_seconds
from public.reports r
where r.status in ('analysis_completed', 'needs_manual_review')
  and r.submitted_at is not null;

grant select on public.verifier_queue_age to authenticated;

comment on view public.verifier_queue_age is
  'Still-open queue reports (same QUEUE_STATUSES as verifier_report_queue/command_dashboard_metrics'' overdue-style predicates) with their current age in seconds, for the queue-age distribution on Verifier Analitik.';
