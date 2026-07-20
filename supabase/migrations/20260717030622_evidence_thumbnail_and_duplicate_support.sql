-- ============================================================================
-- report_evidence: thumbnail_path + dimensions (BLOCK 15)
-- ============================================================================
-- BLOCK 15 adds a generated thumbnail (for the Verifier's queue list, so a
-- full-resolution signed-URL fetch isn't needed just to browse) and the
-- decoded image dimensions (needed to enforce/record the resolution floor
-- validated at upload time, and useful context for the Verifier without
-- re-decoding the original).

alter table public.report_evidence
  add column thumbnail_path text,
  add column width_px integer check (width_px is null or width_px > 0),
  add column height_px integer check (height_px is null or height_px > 0);

comment on column public.report_evidence.thumbnail_path is
  'Storage path of a small, EXIF-stripped thumbnail generated at upload time (same bucket, prefix thumb-<sha256_hash>) — lets the Verifier queue list render a preview without a full-resolution signed-URL fetch.';

-- ============================================================================
-- report_evidence: exact-duplicate detection support
-- ============================================================================
-- "duplicate hash creates a warning but is not silently discarded" (BLOCK 15
-- acceptance) means: an exact SHA-256 match against another report's
-- evidence is detected at upload time and surfaced back to the caller and to
-- the Verifier — the row is still inserted, never rejected or silently
-- deduplicated away. This index makes that lookup an index scan, not a
-- sequential scan across the whole table on every upload.
create index report_evidence_sha256_hash_idx on public.report_evidence (sha256_hash);

-- ============================================================================
-- report_evidence: idempotent re-upload support
-- ============================================================================
-- "repeated offline replay does not duplicate reports" (BLOCK 15
-- acceptance) extends to evidence: the offline sync-replay logic
-- (apps/web/src/lib/offline/sync-replay.ts) may call the evidence endpoint
-- more than once for the same report+file if a prior attempt's response was
-- lost after the server-side work actually completed (e.g. a network drop
-- between response and client). A unique constraint on (report_id,
-- sha256_hash) lets the evidence route upsert instead of inserting a second
-- row for what is, byte-for-byte, the same photo already recorded for that
-- report — this is a different scope than report_evidence_sha256_hash_idx
-- above, which detects the SAME hash on a DIFFERENT report (cross-report
-- duplicate warning), not a retried upload of the same report+file.
alter table public.report_evidence
  add constraint report_evidence_report_id_sha256_hash_unique
  unique (report_id, sha256_hash);

-- Non-blocking, informational only — a NOT NULL default of false, set by the
-- application layer at insert time once it has checked for an existing
-- match. Never auto-updated for older rows by a trigger, since "is this hash
-- a duplicate" is an at-upload-time fact, not something that should silently
-- change later if another report happens to upload a matching photo
-- afterwards (that later upload is the one that discovers and records the
-- match, per the check-then-insert order in the evidence route).
alter table public.report_evidence
  add column is_duplicate_hash boolean not null default false;

comment on column public.report_evidence.is_duplicate_hash is
  'True if, at upload time, this SHA-256 hash already existed on another report''s evidence — an informational warning surfaced to the Verifier, never a rejection.';
