# MBOYO — Incident Response & Triage Protocol

This document outlines emergency handling procedures, escalation paths, and diagnostic workflows for operational incidents in the **MBOYO** platform.

---

## 1. Incident Severity Definitions

- **SEV-1 (Critical)**: Platform unavailable, offline report synchronization completely failing, or data corruption occurring during disaster response.
- **SEV-2 (Major)**: ML API inference microservice down (falling back to manual verifier review queue), or vector map tile server degraded.
- **SEV-3 (Minor)**: Non-critical dashboard visual glitch, non-blocking telemetry delay, or slow export job.

---

## 2. Emergency Triage Checklist

When an alert fires or system outage is reported:

1. **Check System Health Dashboard**:
   - Access `/admin/kesehatan` to review real-time status of:
     - Next.js Web BFF
     - Supabase Postgres & Storage
     - FastAPI ML API
     - Worker Queue Depth
     - Gemini External Advisory integration
2. **Inspect Sentry & Application Logs**:
   ```bash
   # Stream worker logs
   docker-compose logs -f --tail=100 worker

   # Stream ML API logs
   docker-compose logs -f --tail=100 ml-api
   ```
3. **Verify Database Connections**:
   Ensure connection pooler limit is not exhausted.

---

## 3. Specific Outage Playbooks

### Playbook A: ML API Outage / Crash
1. System automatically transitions analysis jobs to `needs_manual_review` state.
2. Reports bypass automated vision triage and land directly in the Human Verifier Queue.
3. No citizen report data is lost.

### Playbook B: Supabase Database Outage
1. Web application UI displays sticky offline banner: *"Mode Terputus — Laporan Anda Tersimpan Aman di Perangkat"*.
2. All submitted reports are safely stored in browser IndexedDB (`mboyo-offline`).
3. Background sync worker automatically retries when database connectivity resumes.

### Playbook C: Excessive Queue Backlog
1. Scale worker containers:
   ```bash
   docker-compose up -d --scale worker=5
   ```
2. Monitor job completion latency in `/admin/kesehatan`.
