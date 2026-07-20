# MBOYO Risk Register

Each risk entry follows: **Description**, **Likelihood**, **Impact**, **Mitigation**, **Residual Risk / Owner**. This register is a living document — update it as mitigations are implemented or new risks are discovered; do not delete resolved risks, mark them resolved instead so the history remains visible to the Auditor role.

## 1. Network Unavailability / Intermittent Connectivity

**Description:** Reporters operate in disaster conditions where cellular/Wi-Fi connectivity is degraded, intermittent, or entirely absent.
**Likelihood:** High — this is the expected operating condition, not an edge case.
**Impact:** High if unmitigated — report loss would defeat the product's core purpose.
**Mitigation:** Offline-first architecture ([AGENTS.md](../../AGENTS.md) offline-first invariants) — report creation has zero live-network dependency; Dexie/IndexedDB local queue; Background Sync retries automatically on reconnect; idempotent sync prevents duplicate incidents from retry storms.
**Residual Risk:** Low, contingent on the offline invariants actually being enforced and tested (not just documented) in every block touching the Reporter flow. Owner: engineering, verified per-block against [WORKING_CONTRACT.md](WORKING_CONTRACT.md) Definition of Done.

## 2. Browser Storage Limits / Eviction

**Description:** Browsers may evict IndexedDB data under storage pressure, private browsing restrictions, or explicit user "clear site data" actions, causing queued unsynced reports to be lost.
**Likelihood:** Medium — more likely on low-end devices with many other apps/data, or if a Reporter's session spans days without sync.
**Impact:** High per incident — a lost report is a lost disaster observation.
**Mitigation:** Request persistent storage (`navigator.storage.persist()`) where supported; surface queue status and unsynced-item count visibly in the Reporter UI so a Reporter knows to sync/prioritize connectivity before an item ages out; document storage-eviction behavior differences across target browsers.
**Residual Risk:** Medium — persistent storage grants are not guaranteed by all browsers/OSes. Owner: engineering; tracked as a known limitation to disclose, not silently absorbed.

## 3. GPS Denial or Spoofing

**Description:** GPS may be unavailable (indoors, urban canyon, device permission denied) or, in adversarial cases, spoofed to misrepresent an incident's location.
**Likelihood:** Medium for denial (common in real-world mobile use); low but non-zero for spoofing given the disaster-reporting context.
**Impact:** Medium-High — location confidence is a key Verifier signal; bad location data misroutes response resources.
**Mitigation:** Report creation must not hard-block on GPS (a Reporter without a location fix can still submit, flagged as low location confidence); location-confidence signal (not raw trust) is surfaced to the Verifier for manual judgment; cross-check GPS coordinates against plausible event geofence where available as an additional confidence signal, not an auto-reject gate.
**Residual Risk:** Medium — spoofing detection is inherently probabilistic; the mitigation is human review, not technical prevention. Owner: Verifier workflow design + engineering.

## 4. Poor Image Quality

**Description:** Field photos may be blurry, poorly lit, obstructed, or otherwise low-quality, degrading both human and model assessment.
**Likelihood:** High — expected given field conditions (motion, weather, lighting, non-professional capture).
**Impact:** Medium — reduces classification confidence rather than causing outright failure, if handled correctly.
**Mitigation:** Quality signal computed and surfaced explicitly to the Verifier alongside model probabilities; low-quality inputs should trigger the abstention path ([SUCCESS_METRICS.md](SUCCESS_METRICS.md) abstention rate) rather than a falsely confident classification; Reporter UI may offer lightweight in-app guidance (e.g., "pastikan foto tidak buram" — ensure photo isn't blurry) without blocking submission.
**Residual Risk:** Medium — cannot be fully mitigated at capture time in emergency conditions; the system is designed to make quality visible rather than assume it away. Owner: ML + product.

## 5. Model Bias

**Description:** The CV model may perform unevenly across geography, lighting conditions, building types, or image sources represented unevenly in training data, producing systematically worse results for underrepresented conditions.
**Likelihood:** Medium-High, especially early in the model's lifecycle before diverse training data is collected.
**Impact:** High if undetected — biased misclassification could systematically under-prioritize certain areas or damage types.
**Mitigation:** Macro-F1 (not accuracy) as the primary metric specifically to avoid rewarding majority-class performance ([SUCCESS_METRICS.md](SUCCESS_METRICS.md)); destroyed recall tracked separately as the highest-stakes class; evaluation reports in `ml/reports/` should stratify performance by available metadata (e.g., region, image source) where feasible; human verification remains mandatory regardless of model confidence, providing a structural check against automation bias.
**Residual Risk:** Medium-High until stratified evaluation tooling exists (Production tier). Owner: ML, tracked against the release gate.

## 6. `apps/ml-api` / Worker Service Outage

**Description:** The inference API or job worker may crash, time out, or become unreachable.
**Likelihood:** Medium.
**Impact:** Medium — report ingestion must not be blocked by this ([PRODUCTION_SCOPE.md](PRODUCTION_SCOPE.md) reliability section), but Verifier throughput stalls without analysis results.
**Mitigation:** `analysis_jobs` queue decouples ingestion from inference — jobs queue and retry independently; report submission succeeds regardless of ml-api health; System Administrator gets service-health visibility (Production tier) to detect and respond to outages.
**Residual Risk:** Low for data loss, medium for temporary Verifier-side throughput impact during an outage. Owner: engineering/infra.

## 7. Map Tile Provider Outage

**Description:** MapLibre GL JS depends on an external map style/tile source (MapTiler); that provider could be unavailable or rate-limited.
**Likelihood:** Low-Medium.
**Impact:** Medium — Coordinator's primary spatial view degrades, but incident data itself is not lost.
**Mitigation:** Coordinator UI must offer a non-map (list/table) fallback view of incidents so the map is an enhancement, not a single point of failure for operational visibility.
**Residual Risk:** Low, given the fallback view. Owner: engineering.

## 8. Supabase Outage

**Description:** Supabase (Auth, Postgres/PostGIS, Storage, Realtime) is a hard platform dependency; an outage affects auth, persistence, and sync.
**Likelihood:** Low (managed service), but non-zero and outside MBOYO's control.
**Impact:** High — Reporter offline queue absorbs the outage for report creation, but Verifier/Coordinator/Auditor workflows (which require server data) are blocked for the outage's duration.
**Mitigation:** Offline-first design means no report data is lost even during an outage — reports queue locally and sync once Supabase recovers; status/health visibility so System Administrator and users understand degraded state rather than assuming silent failure.
**Residual Risk:** Medium — this is accepted as a capstone-scope limitation per [PRODUCTION_SCOPE.md](PRODUCTION_SCOPE.md) (no multi-region failover). Owner: infra, disclosed as a known dependency risk.

## 9. External Gemini Advisory Risk

**Description:** If enabled, Gemini provides advisory input; risks include unavailability, cost overruns, hallucinated/incorrect advisory content, or data leaving the system boundary to a third party.
**Likelihood:** Medium (dependent on whether/when this integration is enabled — not in MVP scope).
**Impact:** Low-Medium, strictly bounded by design — Gemini is never authoritative per [AGENTS.md](../../AGENTS.md) and [WORKING_CONTRACT.md](WORKING_CONTRACT.md).
**Mitigation:** Gemini output is always visibly labeled as advisory/AI-generated, in Bahasa Indonesia ("Analisis Tambahan Eksternal — Tidak Menentukan Keputusan Resmi"); Verifier decisions never block on or auto-adopt Gemini output; a raw evidence image is sent only when the feature is enabled, explicitly requested by the Verifier per-call, and both a consent and an external-cloud-disclosure acknowledgement are accepted for that specific request — a redacted (downscaled/blurred) derivative or no image at all (only derived, non-visual metadata) is the default and preferred path. Implemented (BLOCK 22): server-only `GEMINI_API_KEY`, a fixed system instruction that never concatenates reporter-supplied text into the instruction (untrusted content is passed as an explicitly labeled data block, per [THREAT_MODEL.md](../security/THREAT_MODEL.md)'s Gemini Prompt Injection entry), structured-output-only responses (Gemini cannot free-form its way out of the defined schema), a per-process timeout/retry/rate limiter, and a complete audit trail (`gemini_advisory_requests`, including failed/timed-out/rate-limited attempts) that never stores chain-of-thought — only the final structured fields.
**Residual Risk:** Low — the code-level enforcement above closes the "policy only" gap this risk originally flagged. Owner: engineering. Still open: hallucinated/incorrect advisory content cannot be fully eliminated by structural defenses alone (the non-binding hypothesis is always shown as non-binding, never as a classification, which is the accepted residual mitigation).

## 10. Sensitive Imagery

**Description:** Disaster-report photos may incidentally contain identifiable individuals, deceased persons, or other sensitive content.
**Likelihood:** Medium — plausible in real disaster contexts even when not the intent of the report.
**Impact:** High — privacy, dignity, and potentially legal/ethical exposure if mishandled.
**Mitigation:** Raw evidence access is role-gated (never public URLs) per [AGENTS.md](../../AGENTS.md) secrets/security rules; exports exclude raw evidence and unnecessary PII by default ([PRODUCTION_SCOPE.md](PRODUCTION_SCOPE.md)); retention policy governs how long raw evidence is kept; this register does not currently define automated sensitive-content detection — that is a Production-tier or later capability gap, disclosed here rather than assumed solved.
**Residual Risk:** Medium-High until automated detection/redaction exists; human process (Verifier/Administrator awareness) is the current control. Owner: product + legal/compliance judgment, engineering for access controls.

## 11. Demo Failure (Live Presentation Risk)

**Description:** The live MVP flow demo fails during presentation due to environment flakiness, network issues at the venue, or an untested edge case.
**Likelihood:** Medium — inherent to live software demos, compounded by the offline/reconnect flow being central to the pitch.
**Impact:** High for the hackathon outcome specifically.
**Mitigation:** Demo reliability tracked as an explicit metric ([SUCCESS_METRICS.md](SUCCESS_METRICS.md)); `DEMO_MODE` provides a disclosed, deterministic fallback path for the offline/reconnect toggle specifically (not for ML inference, which is never mocked); rehearsal runs (Phase 1, step 10 in [DELIVERY_ROADMAP.md](DELIVERY_ROADMAP.md)) against real infrastructure before the actual presentation; a recorded backup walkthrough may be prepared as a last-resort fallback, clearly labeled as a recording if ever shown.
**Residual Risk:** Medium — irreducible to zero for any live demo; mitigated by rehearsal discipline and an honest, labeled fallback path rather than pretending the risk doesn't exist. Owner: whole team, ahead of the presentation date.

## 12. Training Data Licensing and Provenance

**Description:** Third-party imagery added to the ML training dataset (`ml/data/raw/`) may carry an unclear, missing, or training-incompatible license, or may have been sourced without a documented consent basis for privacy-sensitive content (identifiable individuals, deceased persons) — exposing the project to legal/ethical liability and undermining the dataset's own credibility.
**Likelihood:** Medium — publicly-visible imagery (news sites, social media, general web search) is a common but legally risky sourcing temptation, especially under time pressure; "I found it online" is not the same as "licensed for ML training use."
**Impact:** High if undetected before a model trained on such data is used in any non-experimental context — potential takedown/legal exposure, and a downstream model whose training data provenance cannot be defended if ever audited.
**Mitigation:** [`ml/ETHICS_AND_PRIVACY.md`](../../ml/ETHICS_AND_PRIVACY.md) requires every source to be recorded in [`ml/data/manifests/SOURCES.md`](../../ml/data/manifests/SOURCES.md) with an explicit license and consent basis before ingestion; `ml/src/prepare_data.py` enforces this structurally — a source directory not registered with a non-blank, non-"unclear" license is excluded from the manifest and reported, never silently ingested; automation in this pipeline never bulk-downloads or scrapes imagery from the open web without a prior, explicit per-source license review recorded first.
**Residual Risk:** Medium — the enforcement above prevents *this pipeline's automation* from silently ingesting an unlicensed source, but cannot prevent a human from manually placing improperly-sourced files into `ml/data/raw/<source_id>/` under a source_id that was registered for a different, legitimately-licensed set of images. The control is process + tooling working together, not a technical guarantee against deliberate misuse. Owner: ML + product, enforced at every `SOURCES.md` addition.
