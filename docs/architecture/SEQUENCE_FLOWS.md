# MBOYO Sequence Flows

These diagrams trace the [MVP live flow](../product/PRODUCT_CHARTER.md#the-mvp-live-flow) at the level of concrete components from [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md). Every arrow here must correspond to a real call in the implemented system — if a block deviates from these flows, this document should be updated in that block, not left stale.

## Diagram 2 — Online Report (network available at submission time)

```mermaid
sequenceDiagram
    actor Reporter
    participant UI as Web UI
    participant IDB as IndexedDB (Dexie)
    participant Web as apps/web (BFF)
    participant DB as Supabase Postgres
    participant Storage as Supabase Storage

    Reporter->>UI: Capture photo + GPS, fill report
    UI->>IDB: Save report locally (status: pending)
    UI->>Web: Submit report (session cookie)
    Web->>Web: Validate payload (zod), check Reporter role
    Web->>Storage: Upload evidence to private bucket
    Storage-->>Web: Storage path
    Web->>DB: Insert report row (status: submitted) + evidence path
    Web->>DB: Insert analysis_jobs row (status: queued)
    DB-->>Web: Confirmed (report_id, job_id)
    Web-->>UI: 201 Created
    UI->>IDB: Mark local report synced, store report_id
```

## Diagram 3 — Offline Replay (created offline, synced later)

```mermaid
sequenceDiagram
    actor Reporter
    participant UI as Web UI
    participant SW as Service Worker
    participant IDB as IndexedDB (Dexie)
    participant Web as apps/web (BFF)
    participant DB as Supabase Postgres

    Reporter->>UI: Capture photo + GPS, fill report (offline)
    UI->>IDB: Save report locally (status: pending, dedupe_key generated)
    UI-->>Reporter: Show "queued, will sync" (Bahasa Indonesia)
    Note over UI,IDB: Page reload — queue read back from IndexedDB, status unchanged
    Reporter->>UI: Reconnect (real network or DEMO_MODE toggle)
    UI->>SW: Register Background Sync event
    SW->>IDB: Read pending reports
    SW->>Web: POST report + dedupe_key
    Web->>DB: Upsert on dedupe_key (idempotent — no-op if already present)
    alt First delivery
        DB-->>Web: Report created, job enqueued
    else Retry / duplicate delivery
        DB-->>Web: Existing report returned, no new row, no new job
    end
    Web-->>SW: 200 OK (report_id)
    SW->>IDB: Mark synced
    SW-->>UI: Notify sync complete
```

## Diagram 4 — Analysis Job (worker claim → inference → write-back)

```mermaid
sequenceDiagram
    participant DB as Supabase Postgres (analysis_jobs)
    participant Worker as apps/worker
    participant MLApi as apps/ml-api
    participant Storage as Supabase Storage

    loop Poll loop
        Worker->>DB: UPDATE analysis_jobs SET status='processing', claimed_by=self\nWHERE status='queued' ... RETURNING (atomic claim)
        DB-->>Worker: Claimed job (or none)
    end
    Worker->>Storage: Fetch evidence image (service-role)
    Worker->>MLApi: POST /infer {image, report metadata} + ML_INTERNAL_TOKEN
    MLApi->>MLApi: Run model (or return advisory-only flag if release gate unmet)
    MLApi-->>Worker: probabilities, quality signal, duplicate signal, location confidence, model_version
    alt Inference succeeds
        Worker->>DB: UPDATE analysis_jobs SET status='done', result=..., model_version=...
    else Inference fails / times out
        Worker->>DB: UPDATE analysis_jobs SET status='failed', error=..., attempts+=1
        Note over Worker,DB: Job becomes re-claimable after lease expiry if attempts < max
    end
```

## Diagram 5 — Verification to Response Task

```mermaid
sequenceDiagram
    actor Verifier
    actor Coordinator
    participant Web as apps/web (BFF)
    participant DB as Supabase Postgres

    Verifier->>Web: Open Verifier queue
    Web->>DB: Query reports with completed analysis_jobs (RLS: Verifier role)
    DB-->>Web: Reports + probabilities + quality + location confidence
    Web-->>Verifier: Render evidence review UI
    Verifier->>Web: Confirm / Override / Reject / Request info / Escalate
    Web->>DB: Insert verification_decision (immutable, attributed, timestamped)
    Web->>DB: Update report.status accordingly

    alt Verified or Escalated
        DB-->>Web: Realtime notify
        Web-->>Coordinator: New verified/escalated incident visible on map + list
        Coordinator->>Web: Set priority, group incident, create response task
        Web->>DB: Insert response_task (assigned, priority, linked incident_id)
        Web->>DB: Insert audit_event (task created)
    end

    Web->>DB: Refresh analytics aggregates (counts by severity/status)
    Web-->>Coordinator: Analytics view updates
```

## Diagram 6 — Deployment

See [DEPLOYMENT_TOPOLOGY.md](DEPLOYMENT_TOPOLOGY.md) for the deployment diagram and narrative.

## Cross-Cutting Notes

- Every write in these flows produces an `audit_event` row (report created, synced, job claimed/completed, verification decision, task created/assigned) so the Auditor's lineage view (per [PRODUCT_CHARTER.md](../product/PRODUCT_CHARTER.md)) is a direct query, not a reconstruction.
- Idempotency in Diagram 3 relies on a client-generated `dedupe_key` (e.g., a UUID created at report-creation time, not at sync time) so retried sync attempts — including ones that cross a reload — never create duplicate incidents.
- Diagram 4's atomic claim (`UPDATE ... RETURNING`) is what makes concurrent `apps/worker` instances safe without an external lock service — this is the core justification in [ADR 0003](../adr/0003-database-job-queue.md).
