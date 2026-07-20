-- BLOCK 23 — verifier_report_queue: a security_invoker view pre-joining
-- each report's LATEST model_predictions row (top predicted severity +
-- confidence, quality_score, duplicate_candidate_report_id) and LATEST
-- geolocation_observations row (accuracy_meters, confidence_signal) plus
-- reports.escalated, so the Antrean Verifikasi queue can filter/sort on
-- severity/confidence/quality/duplicate/GPS-accuracy/age/escalation
-- directly via ordinary PostgREST query params — a plain .from("reports")
-- query has no way to express "top predicted class" or "latest
-- observation" without this pre-computation, since both are
-- one-of-many-rows-per-report relationships.
--
-- security_invoker (not the Postgres default security_definer-like
-- behavior for views, which would run as the view owner and bypass RLS)
-- means every SELECT against this view re-checks RLS on reports/
-- model_predictions/geolocation_observations AS THE CALLING ROLE — a
-- Coordinator querying this view still cannot see an unverified report's
-- row (reports_coordinator_select_verified) or its evidence-adjacent
-- prediction/location data (model_predictions_coordinator_select_verified /
-- geolocation_observations_coordinator_select_verified), exactly as if
-- they had queried those tables directly. This view adds no new
-- authorization surface — it only reshapes already-RLS-gated data for
-- query convenience.

create view public.verifier_report_queue
with (security_invoker = true)
as
select
  r.id,
  r.client_report_id,
  r.reporter_profile_id,
  r.disaster_event_id,
  r.status,
  r.description,
  r.escalated,
  r.submitted_at,
  r.created_at,
  r.updated_at,
  latest_prediction.top_severity,
  latest_prediction.top_confidence,
  latest_prediction.quality_score,
  latest_prediction.duplicate_candidate_report_id,
  latest_prediction.is_advisory_only,
  latest_observation.accuracy_meters as gps_accuracy_meters,
  latest_observation.confidence_signal as gps_confidence_signal,
  latest_observation.longitude as gps_longitude,
  latest_observation.latitude as gps_latitude,
  latest_review.verifier_profile_id as last_reviewed_by_verifier_profile_id
from public.reports r
left join lateral (
  select
    (
      select key
      from jsonb_each_text(mp.severity_probabilities) as kv(key, value)
      order by value::numeric desc
      limit 1
    ) as top_severity,
    (
      select max(value::numeric)
      from jsonb_each_text(mp.severity_probabilities) as kv(key, value)
    ) as top_confidence,
    mp.quality_score,
    mp.duplicate_candidate_report_id,
    mp.is_advisory_only
  from public.model_predictions mp
  where mp.report_id = r.id
  order by mp.created_at desc
  limit 1
) as latest_prediction on true
left join lateral (
  select go.accuracy_meters, go.confidence_signal, go.longitude, go.latitude
  from public.geolocation_observations go
  where go.report_id = r.id
  order by go.created_at desc
  limit 1
) as latest_observation on true
left join lateral (
  select vr.verifier_profile_id
  from public.verification_reviews vr
  where vr.report_id = r.id
  order by vr.decided_at desc
  limit 1
) as latest_review on true;

comment on view public.verifier_report_queue is
  'Read-only, security_invoker view for the Antrean Verifikasi queue (BLOCK 23) — pre-joins each report''s latest model_predictions/geolocation_observations/verification_reviews signals so filters (predicted severity, confidence, quality, duplicate, GPS accuracy, escalation, "reviewed by me") can run as ordinary column filters. security_invoker means RLS on the underlying tables is re-checked per caller — this view grants no access beyond what reports/model_predictions/geolocation_observations/verification_reviews RLS already allows that role.';

grant select on public.verifier_report_queue to authenticated;
