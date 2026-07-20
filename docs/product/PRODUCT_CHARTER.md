# MBOYO Product Charter

## Vision

MBOYO ("Laporan Tetap Jalan. Respons Lebih Tepat.") makes disaster reporting resilient to the exact conditions disasters create: broken networks, unreliable connectivity, and time pressure. A report started in the field must survive to become a verified, prioritized, dispatched response — with a full audit trail from the photo taken at the scene to the task closed by a coordinator.

## Problem Statement

During disasters, connectivity is often the first casualty. Reporters on the ground need to capture evidence (photo + location) the moment they observe damage, but cannot rely on immediate connectivity to submit it. Meanwhile, response organizations need triaged, verified, geolocated incident data quickly — not a flood of unverified, duplicate, or low-quality reports. Existing tooling generally assumes either (a) always-on connectivity, or (b) manual triage with no computer-vision assistance, or (c) automated classification with no human accountability layer. MBOYO closes this gap by combining offline-first capture, CV-assisted (not CV-decided) verification, and role-separated operational response.

## Who This Is For

- **Reporter** — a citizen or field worker present at or near a disaster site, using a phone, possibly with degraded or no connectivity.
- **Verifier** — a trained operator reviewing incoming evidence, resolving duplicates/quality/location issues, and making the human classification call.
- **Response Coordinator** — an operations role turning verified incidents into prioritized, assigned, tracked response tasks.
- **System Administrator** — manages users, roles, events, integration configuration, and retention/thresholds.
- **Auditor** — read-only stakeholder (e.g., compliance, oversight body, evaluator) needing full lineage visibility without any ability to alter it.

## Product Pillars

1. **Offline-first, not offline-tolerant.** Report creation never depends on network availability. Sync is a background concern, not a blocking one.
2. **Human-in-the-loop verification.** Computer vision produces probabilities and explanations; only a human Verifier converts those into a classification decision.
3. **Separation of duties.** Each of the five roles has a distinct, non-overlapping capability set (see [AGENTS.md](../../AGENTS.md) RBAC section) — no role can silently assume another's authority.
4. **Auditable by construction.** Every state transition (report → analysis → verification → dispatch) is attributable, timestamped, and visible to the Auditor role without requiring special reconstruction.
5. **Honest about uncertainty.** No accuracy or reliability claim is asserted without a measured, dated evaluation. Demo fallbacks are always disclosed, never disguised as live behavior.

## The MVP Live Flow

The single flow that MBOYO must demonstrate end-to-end, live, in production mode:

```text
Reporter login
  → create photo/GPS report
  → go offline
  → submit
  → queue persists after reload
  → reconnect
  → automatic idempotent sync
  → analysis job (CV inference)
  → verifier sees probabilities/quality/GPS
  → verifier confirms or overrides
  → coordinator sees verified incident
  → coordinator creates response task
  → escalation appears
  → analytics/export update
  → auditor sees complete lineage
```

Every block of implementation work is ultimately in service of making this flow real, reliable, and demonstrable without fabrication. See [MVP_SCOPE.md](MVP_SCOPE.md) for what "real" means at each tier.

## Relationship to Other Documents

- [AGENTS.md](../../AGENTS.md) — engineering contract, RBAC, architecture boundaries.
- [WORKING_CONTRACT.md](WORKING_CONTRACT.md) — mission, non-goals, definition of done, decision log.
- [MVP_SCOPE.md](MVP_SCOPE.md) / [PRODUCTION_SCOPE.md](PRODUCTION_SCOPE.md) — what ships at each tier.
- [SUCCESS_METRICS.md](SUCCESS_METRICS.md) — how we know it's working.
- [DELIVERY_ROADMAP.md](DELIVERY_ROADMAP.md) — sequencing.
- [RISK_REGISTER.md](RISK_REGISTER.md) — what could break it and how we respond.
