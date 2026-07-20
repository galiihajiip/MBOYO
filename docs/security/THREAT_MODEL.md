# MBOYO Threat Model

Scope: the architecture described in [SYSTEM_ARCHITECTURE.md](../architecture/SYSTEM_ARCHITECTURE.md) and [DEPLOYMENT_TOPOLOGY.md](../architecture/DEPLOYMENT_TOPOLOGY.md). Each entry: **Asset**, **Attacker**, **Likelihood**, **Impact**, **Prevention**, **Detection**, **Recovery**, **Residual Limitation**.

This document complements, and does not duplicate, [RISK_REGISTER.md](../product/RISK_REGISTER.md) — the risk register covers product/operational risk broadly; this document is specifically adversarial threat modeling (an attacker deliberately causing harm), per [AGENTS.md](../../AGENTS.md) security rules.

## 1. Fake Reports

**Asset:** Integrity of the incident dataset; Verifier/Coordinator trust in incoming reports.
**Attacker:** Anonymous or authenticated malicious Reporter submitting fabricated incidents (e.g., to trigger response resources to a location for unrelated gain, or to waste Verifier time).
**Likelihood:** Medium — report creation is intentionally low-friction (offline-first), which lowers the bar for abuse too.
**Impact:** Medium-High — wasted Verifier/Coordinator effort, potential misallocation of real response resources if a fake report is confirmed.
**Prevention:** Reporter authentication is required (no fully anonymous submission); GPS/location-confidence and image-quality signals are surfaced to the Verifier so implausible reports (e.g., stock photo, geofence mismatch) are visible before confirmation; human verification is mandatory — no report becomes an incident without a Verifier decision.
**Detection:** Per-reporter submission-rate monitoring (ties to risk #11, rate abuse); Verifier rejection rate tracked per reporter as a signal for review by System Administrator.
**Recovery:** Rejected reports remain in the audit trail (never deleted) so a pattern of abuse from one account is discoverable; System Administrator can suspend a reporter account.
**Residual Limitation:** A determined attacker with a legitimate-looking account and a genuinely plausible fake photo/location can still consume Verifier time before rejection — this is bounded by human review cost, not eliminated by the architecture.

## 2. Replay / Duplicate Submission

**Asset:** Data integrity of the incident/report table; Coordinator's operational picture.
**Attacker:** A client (malicious or merely buggy) that resubmits the same report multiple times — deliberately (to inflate apparent incident count) or accidentally (retry storm during flaky connectivity).
**Likelihood:** Medium — the offline/reconnect flow is specifically designed to retry, so this is an expected code path, not just a hypothetical attack.
**Impact:** Medium — duplicate incidents distort analytics and could cause redundant dispatch.
**Prevention:** Client-generated `dedupe_key` (UUID created at report-creation time) with a unique constraint enforced at the database layer; sync endpoint performs an idempotent upsert on that key (Diagram 3 in [SEQUENCE_FLOWS.md](../architecture/SEQUENCE_FLOWS.md)) so replays are a no-op, not a new row.
**Detection:** Database unique-constraint violations logged; unusually high per-reporter submission velocity flagged (shared detection path with risk #11).
**Recovery:** Since replays are idempotent no-ops, there is no data to recover from a legitimate retry; for deliberate abuse attempting to bypass the dedupe key with distinct keys for the same content, Verifier duplicate-detection signal (Enhanced Demo tier per [MVP_SCOPE.md](../product/MVP_SCOPE.md)) provides a secondary, content-based check.
**Residual Limitation:** Dedupe-by-key only prevents exact replay; content-based duplicate detection (same incident, different key) is a Tier 2 capability and not present at MVP — until then, near-duplicate reports rely on manual Verifier judgment.

## 3. GPS Spoofing

**Asset:** Location integrity of reports; Coordinator dispatch accuracy.
**Attacker:** A Reporter (or compromised Reporter device) providing a falsified GPS coordinate to misdirect response resources or fabricate presence at a location.
**Likelihood:** Low-Medium — requires deliberate device-level manipulation (mock location tools), more plausible as a targeted act than mass abuse.
**Impact:** Medium-High — misdirected response resources have real-world cost.
**Prevention:** Location-confidence signal (not blind trust) computed and shown to the Verifier; cross-check against event geofence as an additional signal, not an auto-accept/reject gate (per [RISK_REGISTER.md](../product/RISK_REGISTER.md) risk #3); reports without a location fix are marked low-confidence rather than defaulted to a plausible-looking coordinate.
**Detection:** Anomalous jumps in a single reporter's location history across reports flagged for Verifier attention; mock-location OS flags (where the platform exposes them) surfaced as an additional signal if available.
**Recovery:** Verifier rejection of the report; System Administrator review of the reporting account.
**Residual Limitation:** Client-side location data is fundamentally attacker-controlled input — this is mitigated by human review and corroborating signals, never technically eliminated, consistent with [RISK_REGISTER.md](../product/RISK_REGISTER.md) risk #3's residual risk statement.

## 4. Broken Access Control

**Asset:** All role-gated data and actions — the core RBAC guarantees in [AGENTS.md](../../AGENTS.md).
**Attacker:** An authenticated user attempting to access or mutate data/actions outside their role (e.g., a Reporter attempting to read another Reporter's private report, or attempting to call a Coordinator-only endpoint).
**Likelihood:** Medium — this is the most common real-world web app vulnerability class (OWASP Top 10 A01), and MBOYO's five-role model has more surface for misconfiguration than a single-role app.
**Impact:** High — a broken-access-control bug directly violates the non-overlapping RBAC guarantee that is central to the product's trust model.
**Prevention:** RLS policies in `supabase/policies` are the enforcement layer, not just UI hiding, per [AGENTS.md](../../AGENTS.md); every new endpoint/UI action must be checked against exactly one role's allowed-capability list (RBAC section of AGENTS.md) before merge; `apps/web` server routes re-check role server-side even where RLS also applies (defense in depth) rather than trusting client-supplied role claims.
**Detection:** RLS-denial events logged distinctly from application errors so a spike in denials (potential probing) is visible; a per-block review step (per [WORKING_CONTRACT.md](../product/WORKING_CONTRACT.md) Definition of Done) explicitly re-checks RBAC boundaries for anything touched in that block.
**Recovery:** Revoke/patch the offending policy or route; audit log (immutable, per [AGENTS.md](../../AGENTS.md)) shows what was actually accessed during the window the bug existed, informing disclosure/remediation scope.
**Residual Limitation:** RLS and server-side checks reduce but cannot formally prove the absence of authorization bugs without a full security audit, which is explicitly out of capstone scope per [PRODUCTION_SCOPE.md](../product/PRODUCTION_SCOPE.md).

## 5. Signed URL Leakage

**Asset:** Confidentiality of evidence photos in the private Storage bucket.
**Attacker:** Anyone who obtains a signed URL not intended for them (e.g., via browser history, referrer leakage, shared screenshot, or a URL logged somewhere it shouldn't be) and uses it before expiry.
**Likelihood:** Medium — signed URLs are a common leakage vector when not handled carefully (e.g., appearing in `Referer` headers to third-party resources, or in analytics/logging).
**Impact:** Medium-High given [RISK_REGISTER.md](../product/RISK_REGISTER.md) risk #10 (sensitive imagery) — leaked evidence could expose identifiable individuals.
**Prevention:** Signed URLs are issued with short expiry, scoped to a single object, and only after `apps/web` re-checks the requester's role/authorization for that specific report; evidence images are not embedded as `<img src>` in any context that would send the URL to a third-party origin as a referrer; signed URLs are never logged in plaintext application logs.
**Detection:** Storage access logs (where Supabase exposes them) reviewed for access patterns inconsistent with the issuing session; unusually high access counts on a single object flagged.
**Recovery:** Revoke/rotate the bucket's signing configuration if a systemic leak is suspected; re-issue with tighter expiry; notify affected reporters/subjects per data-governance process if a real exposure occurred.
**Residual Limitation:** A short-lived signed URL is inherently bearer-token-like — anyone who obtains it during its validity window can use it; the mitigation is minimizing exposure window and surface, not eliminating the risk class.

## 6. Service-Role Key Exposure

**Asset:** `SUPABASE_SERVICE_ROLE_KEY` — the single most powerful credential in the system, bypassing RLS entirely.
**Attacker:** Anyone who obtains this key through a code/config leak, a misconfigured client bundle, a compromised CI pipeline, or accidental commit.
**Likelihood:** Low if disciplined, but the impact is severe enough to warrant strong controls regardless — this is exactly the class of mistake [AGENTS.md](../../AGENTS.md) secrets rules exist to prevent.
**Impact:** Critical — full read/write access to all data across all roles, bypassing every RBAC boundary in the system.
**Prevention:** Never referenced in any `NEXT_PUBLIC_*` variable or client-bundled code (enforced by the build-time check described in [PRODUCTION_SCOPE.md](../product/PRODUCTION_SCOPE.md)); confined to `apps/web` server runtime and `apps/worker`, both with no public ingress for the worker and server-only execution context for web routes using it; `.env` files never committed, per [AGENTS.md](../../AGENTS.md); secret scanning in CI (Production tier requirement).
**Detection:** Anomalous query patterns against Supabase using service-role credentials from an unexpected source IP/network (where audit logging is available); dependency/secret scanners flagging accidental commits before merge.
**Recovery:** Immediate key rotation in Supabase project settings; audit log review (using a *new* key) to scope what was accessed with the compromised key during its exposure window.
**Residual Limitation:** Formal secret-scanning CI and key-rotation runbooks are listed as Production-tier requirements not yet implemented (per [PRODUCTION_SCOPE.md](../product/PRODUCTION_SCOPE.md)) — until implemented, prevention relies on code review discipline alone.

## 7. Malicious Files (Evidence Upload)

**Asset:** `apps/ml-api`, `apps/worker`, Storage integrity; any downstream consumer that opens an uploaded "photo."
**Attacker:** A Reporter (or compromised Reporter session) uploading a file crafted to exploit an image-parsing vulnerability, deliver a payload disguised as an image, or exhaust resources (zip bomb-style oversized/malformed image).
**Likelihood:** Medium — file upload is a standard, well-known attack surface, and this system has real photo upload as a core feature.
**Impact:** Medium-High — could range from resource exhaustion (DoS-adjacent) to remote code execution in an image-processing library if unpatched.
**Prevention:** Server-side validation of file type via content sniffing (not just trusting the client-provided MIME type/extension), size limits enforced before storage, and image re-encoding/normalization (which both sanitizes malformed structure and standardizes the format `apps/ml-api` expects) before persisting; `apps/ml-api`/`apps/worker` use well-maintained, patched image libraries (Pillow/OpenCV) kept up to date.
**Detection:** Upload rejection rate monitored for spikes suggesting probing; `apps/ml-api`/`apps/worker` crash/error logs monitored for parser-related failures.
**Recovery:** Rejected/quarantined files are not persisted to the evidence bucket; if a malformed file is found already stored, System Administrator can remove it and the associated report is flagged for Verifier re-review.
**Residual Limitation:** Zero-day vulnerabilities in image-processing libraries are not preventable by validation alone; the mitigation is patch currency and re-encoding (which closes most format-exploitation vectors) rather than a guarantee.

## 8. Gemini Prompt Injection

**Asset:** Integrity of the advisory text shown to the Verifier; the boundary that Gemini output must never become authoritative.
**Attacker:** Content embedded in a report (e.g., text fields, or text visible within an uploaded photo) crafted to manipulate the Gemini prompt into producing misleading advisory output, or attempting to make Gemini's response look like a system directive rather than advisory text.
**Likelihood:** Low — implemented as of BLOCK 22 (Production-tier optional integration per [ADR 0004](../adr/0004-local-ml-primary-gemini-advisory.md)), with the structural defenses below in place.
**Impact:** Low-Medium by design — bounded because Gemini output is never authoritative and the Verifier's decision is never blocked, defaulted, or auto-filled by it, per [AGENTS.md](../../AGENTS.md) and [RISK_REGISTER.md](../product/RISK_REGISTER.md) risk #9.
**Prevention:** Gemini is called only with a fixed system instruction (`apps/web/src/lib/gemini/prompt.ts`) that clearly separates instructions from report content — reporter-supplied text is always passed inside an explicitly labeled "UNTRUSTED REPORT CONTENT" data block, never concatenated into the instruction text, and Gemini is explicitly told to treat any instruction-like text found inside that block as suspicious data to note, not a command to obey; responses are constrained to a fixed structured-output schema (`responseSchema`), so free-form text cannot escape the defined fields; the UI renders Gemini output in a visually and structurally distinct "Analisis Tambahan Eksternal" panel, never as if it were the Verifier's own tool output; a raw evidence image is sent only when explicitly requested per-call with both a consent and an external-cloud-disclosure acknowledgement (risk #9).
**Detection:** Every advisory call (succeeded, failed, timed out, or rate-limited) is recorded as a complete audit row in `gemini_advisory_requests`, readable by Verifier and Auditor — but deliberately holds only the final structured output/error, never the raw prompt or any chain-of-thought reasoning, per this block's explicit "do not store chain-of-thought" requirement; a Verifier reporting suspicious advisory content can still be cross-referenced against the report's own stored description text (which is already retained) to reconstruct what was sent.
**Recovery:** Gemini integration can be disabled instantly by unsetting `GEMINI_API_KEY` (the app already runs correctly with it unset) without affecting any other part of the system, since it's additive and non-authoritative by construction.
**Residual Limitation:** Prompt injection via image content (rather than text) is harder to fully neutralize with prompt-structure defenses alone; the residual mitigation is that Gemini's output can never cause a harmful action by itself — it can only mislead a human who still makes the final call.

## 9. Sensitive Imagery

**Asset:** Privacy and dignity of individuals who may appear in evidence photos (identifiable people, deceased persons).
**Attacker:** Not necessarily adversarial — the primary threat here is mishandling (over-broad access, inclusion in exports, indefinite retention) rather than a malicious actor, though an insider or compromised account could deliberately misuse access.
**Likelihood:** Medium — plausible in real disaster imagery even without any adversarial intent, per [RISK_REGISTER.md](../product/RISK_REGISTER.md) risk #10.
**Impact:** High — privacy/dignity harm, potential legal exposure.
**Prevention:** Private bucket only, signed URLs scoped and short-lived (see threat #5); RLS-gated access strictly limited to roles with a legitimate need (Verifier for review, Auditor for lineage — not raw image content by default, per [PRODUCTION_SCOPE.md](../product/PRODUCTION_SCOPE.md)); exports exclude raw evidence by default; retention policy limits how long raw evidence is kept.
**Detection:** Access logs on the evidence bucket reviewed for roles/accounts accessing images outside their expected workflow pattern.
**Recovery:** System Administrator can restrict/revoke access and adjust retention; no technical mechanism currently redacts sensitive content automatically — this is disclosed, not solved, per [RISK_REGISTER.md](../product/RISK_REGISTER.md) risk #10.
**Residual Limitation:** Automated sensitive-content detection/redaction does not exist in this architecture; the current control is access-gating and retention, which reduces exposure surface but does not detect or obscure sensitive content within an authorized viewer's legitimate access.

## 10. Offline Device Exposure

**Asset:** Locally queued report data (including evidence images) sitting in IndexedDB on a Reporter's device before sync.
**Attacker:** Someone with physical or malware access to a Reporter's device while unsynced reports are queued locally.
**Likelihood:** Medium — field devices in disaster contexts may be more likely to be lost, shared, or borrowed than in ordinary use.
**Impact:** Medium — exposure of not-yet-submitted report content/photos, which may include sensitive imagery per threat #9.
**Prevention:** IndexedDB is same-origin sandboxed by the browser (not accessible to other sites/apps without OS-level compromise); the Reporter UI should avoid persisting unnecessary plaintext session tokens alongside report data; device-level security (screen lock, OS encryption) is a device-owner responsibility outside MBOYO's control but should be called out in Reporter-facing guidance.
**Detection:** Not directly detectable by the server, since this is a local-device threat outside the system's telemetry; a synced report followed by anomalous re-edit attempts could indicate device compromise but this is speculative.
**Recovery:** Once synced, standard server-side access controls and audit trail apply; for pre-sync exposure, there is no remote-wipe capability for local IndexedDB data — a genuine architectural limitation.
**Residual Limitation:** Offline-first inherently means sensitive data exists locally, unencrypted-at-rest-by-default (browser storage is not designed as a security boundary), for the period before sync — this is an accepted tradeoff for the offline-first product pillar and should be disclosed as such, not silently assumed safe.

## 11. Rate Abuse

**Asset:** Availability of `apps/web`, `apps/ml-api` (via job creation), and Verifier throughput.
**Attacker:** A single reporter account or script submitting a high volume of reports/requests to exhaust system resources, flood the Verifier queue, or run up inference costs.
**Likelihood:** Medium — report creation is intentionally low-friction, which is also what makes it abusable at volume.
**Impact:** Medium — degraded Verifier throughput, increased inference load/cost, noisy analytics.
**Prevention:** Per-account and per-IP rate limiting at the `apps/web` BFF layer for report submission and other mutating endpoints; `analysis_jobs` claim/lease mechanism naturally bounds concurrent inference load regardless of queue depth (workers process at their own pace, per [SYSTEM_ARCHITECTURE.md](../architecture/SYSTEM_ARCHITECTURE.md)).
**Detection:** Submission-rate monitoring per account (shared with threat #1 and #2 detection); alerting on queue depth growth rate for System Administrator.
**Recovery:** Temporary rate-limit tightening or account suspension by System Administrator; queued jobs are not lost during a rate-limiting response, only delayed.
**Residual Limitation:** Rate limiting reduces but does not eliminate abuse from an attacker controlling multiple accounts; CAPTCHA or stronger anti-automation controls are not currently in scope and would need explicit product tradeoff discussion given they add friction to genuine emergency reporting.

## 12. Audit Tampering

**Asset:** Integrity of the audit trail that the Auditor role depends on — the entire "auditable by construction" product pillar in [PRODUCT_CHARTER.md](../product/PRODUCT_CHARTER.md).
**Attacker:** An insider (any role, including System Administrator) or an attacker who has compromised elevated credentials, attempting to alter or delete audit events to hide a prior action.
**Likelihood:** Low (requires elevated access already), but high-consequence enough to warrant explicit controls given the Auditor role's entire value proposition depends on this not happening.
**Impact:** Critical — undermines the core trust guarantee that Auditor visibility is complete and reliable.
**Prevention:** `AGENTS.md` explicitly forbids System Administrator from editing or deleting audit events, and Auditor is read-only by construction; audit events are modeled as append-only (insert-only RLS policy, no `UPDATE`/`DELETE` grants to any role, including service-role paths used by ordinary application logic — only an explicit, separately-controlled operational process, if ever needed, could touch this table, and that is not part of normal system operation).
**Detection:** Any attempted `UPDATE`/`DELETE` against the audit table that RLS blocks is itself loggable as a denial event, which is a strong tamper-attempt signal precisely because legitimate flows never attempt it.
**Recovery:** Because the table is append-only, "recovery" from a tampering attempt is mostly about detection and access review rather than data restoration — the append-only design means a blocked attempt leaves no damage to recover from; a successful bypass (e.g., via direct database access outside the application) would require a database-level backup/point-in-time-recovery process to remediate, which is a Supabase-managed capability but not something MBOYO application code implements itself.
**Residual Limitation:** Append-only RLS protects against tampering through the application and ordinary service-role paths, but does not protect against someone with direct database superuser access (e.g., via the Supabase dashboard with sufficiently elevated project permissions) — that level of access control is a Supabase project-administration concern outside this application's threat model boundary, and should be restricted organizationally (limiting who holds Supabase project owner access) rather than assumed solved by RLS alone.

## Gemini: Explicit Opt-In External Advisory Only

Reiterated here for the threat-modeling context: Gemini is never enabled by default, is only ever called server-side from `apps/web`, and its output is never authoritative — it cannot trigger, block, or auto-fill any Verifier decision, Coordinator action, or system state change. Every threat entry above involving Gemini (#8) and every relevant risk entry in [RISK_REGISTER.md](../product/RISK_REGISTER.md) (risk #9) treats this as a hard architectural boundary, not a policy that could be silently weakened by a future block. Any future change to this boundary requires a new ADR explicitly superseding [ADR 0004](../adr/0004-local-ml-primary-gemini-advisory.md).
