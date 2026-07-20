# Location Capture and Trust

This document describes how MBOYO captures, validates, and displays report location — GPS capture, manual map pin, server-side PostGIS validation, and the advisory signals surfaced to the Verifier. Built in BLOCK 17 on top of the offline queue (BLOCK 13), report BFF layer (BLOCK 16), and the `geolocation_observations` schema (BLOCK 08).

See also: [DOMAIN_MODEL.md](../product/DOMAIN_MODEL.md#geolocation_observation), [THREAT_MODEL.md](../security/THREAT_MODEL.md) threat #3 (GPS Denial or Spoofing), [RISK_REGISTER.md](../product/RISK_REGISTER.md) risk #3 and risk #7 (Map Tile Provider Outage), [REPORTS_API.md](../api/REPORTS_API.md).

## Core principle: GPS is never guaranteed truth

Every piece of location UI/copy in this system — the wizard's GPS step, the manual-pin map, the Verifier's location panel — describes location as a **signal**, never a fact. No screen states or implies that a captured coordinate is confirmed, exact, or verified. This is a hard requirement, not a style preference: `confidence_signal` (below) is explicitly a corroboration score, not an accuracy probability, and its own doc comment in the migration says so.

## Client-side capture

### GPS (`apps/web/src/app/reporter/laporan/baru/steps/GpsStep.tsx`)

- `navigator.geolocation.getCurrentPosition` with `enableHighAccuracy: true`, `timeout: 15000`, **`maximumAge: 0`** (explicit — a retry must never silently reuse a stale cached fix).
- Captures `latitude`, `longitude`, `accuracy` (meters), `altitude`, `heading`, and the position `timestamp`.
- Denial/unavailability never blocks the wizard — "Gunakan Peta / Alamat Manual" is always present (per RISK_REGISTER.md risk #3).
- The accuracy circle is drawn on an embedded read-only map (not just stated as text) so the Reporter sees the real spatial extent of the uncertainty, not just a number.
- "Ambil Ulang Lokasi" (retry) re-requests a fresh fix.

### Manual map pin (`apps/web/src/app/reporter/laporan/baru/steps/ManualLocationStep.tsx`)

- A real draggable MapLibre GL JS pin (`apps/web/src/components/map/MapPin.tsx`), dynamically imported with `ssr: false` (WebGL requires a browser context).
- Numeric lat/lng inputs and a free-text address field stay in sync with the pin — three ways to specify the same location.
- Falls back to a plain coordinate message (no map, no crash) if the map style fails to load — the map is always an enhancement, never a hard dependency for submitting a report, per RISK_REGISTER.md risk #7's "non-map fallback" requirement.

### `MapPin` component

Shared by the Reporter's manual-pin step, the GPS step's accuracy display, and the Verifier's location panel — one component, one place the `[longitude, latitude]` convention is enforced for every map interaction (MapLibre's own coordinate order matches GeoJSON's, so this is a natural fit, not an adaptation). Supports:
- `draggable` (Reporter placement) vs. read-only (Verifier/GPS display) modes.
- An accuracy circle, computed as a true geodesic-approximated polygon (not a fixed-pixel-radius overlay, which would misrepresent the real-world radius at any zoom level other than the one it was drawn at).
- An optional geofence outline overlay (advisory only — see below).

## Server-side validation and advisory signals

### `record_geolocation_observation()` (the only sanctioned write path)

A `SECURITY DEFINER` Postgres function ([migration](../../supabase/migrations/20260717043726_location_trust.sql)), following the same pattern as `append_audit_event`/`claim_analysis_jobs`/`submit_verification_decision` (BLOCK 08/16). In one atomic transaction:

1. **Ownership check** — `owns_report(p_report_id)`, mirroring the RLS insert policy.
2. **Coordinate-range validation** — longitude ∈ [-180, 180], latitude ∈ [-90, 90]; out-of-range raises a `22023` exception, translated to `validation_failed` by the domain-service layer.
3. **PostGIS point construction** — `st_makepoint(p_longitude, p_latitude)`, i.e. **longitude first** — this is the one place in the whole pipeline where getting the order backwards would silently place a report in the wrong hemisphere without necessarily looking wrong (lat/lon magnitudes overlap near the equator, so this bug class doesn't announce itself).
4. **Geofence distance/boundary** — when the report's `disaster_event.geofence` polygon is set: `distance_to_event_center_meters` (`st_distance` to the geofence's centroid) and `outside_event_boundary` (`not st_within`). Both are `null` when the event has no geofence — there is nothing to compare against, not a false "inside."
5. **Suspicious-pattern flags** — a `jsonb` array of short codes (`implausible_accuracy`, `outside_event_boundary`, `duplicate_coordinates`), each a coarse, explainable heuristic. **Advisory only** — per this block's explicit requirement, nothing in this system reads these flags to reject or auto-hide a report. They exist purely to draw a Verifier's attention.
6. **`confidence_signal`** (0–1, the column BLOCK 08 defined but never populated) — a source-based baseline (GPS highest, manual pin lower, manual address lowest) adjusted by observable signals (device-reported accuracy tier, boundary agreement, duplicate detection). Deliberately simple, explainable arithmetic — not a model — so any value can be reconstructed by a Verifier or Auditor from the same row's other columns. **Never a claim that the location is correct**, only that more or less corroborating signal exists.
7. **Insert** the observation row, generated `longitude`/`latitude` columns (`st_x`/`st_y` on the stored point — PostgREST cannot decode a raw `geography` column, so these generated columns re-expose the coordinates for the API layer to read back).
8. **Audit event** — `report.location_recorded`, via `append_audit_event`.

A report may accumulate multiple observations (a Reporter retrying GPS for a better fix, or capturing via GPS then falling back to a manual pin) — this function always inserts a new row, consistent with `geolocation_observations`' insert-only RLS (no `UPDATE`/`DELETE` policy for any role) and [DOMAIN_MODEL.md](../product/DOMAIN_MODEL.md)'s explicit multi-observation design.

### Never an auto-reject gate

Per [THREAT_MODEL.md](../security/THREAT_MODEL.md) threat #3: "cross-check GPS coordinates against plausible event geofence... as an additional confidence signal, not an auto-reject gate." Nothing in `record_geolocation_observation()`, the API layer, or the client ever refuses to record a location, refuses to submit a report, or auto-changes a report's status based on `outside_event_boundary` or `suspicious_pattern_flags`. The **only** consumer of these signals is the Verifier's read-only display.

### Distance/reverse-geocode read path

`GET /api/reports/:reportId/location` (RLS-scoped — Reporter sees only their own, Verifier sees all, Coordinator sees `verified` reports only, matching `geolocation_observation`'s RBAC_MATRIX.md row) lists every observation for a report, most recent first.

## Reverse geocoding (optional)

`apps/web/src/lib/location/reverse-geocode.ts` defines a `ReverseGeocoder` adapter interface with two implementations:
- **`NullReverseGeocoder`** — always resolves `null`. Active whenever `MAPTILER_API_KEY` is unset (no fabricated address, per AGENTS.md's demo-fallback-disclosure rule).
- **`MapTilerReverseGeocoder`** — cache-first (`reverse_geocode_cache` table, coordinates rounded to 4 decimal degrees / ~11m so nearby lookups share an entry), falls back to `null` on any provider/network failure rather than throwing.

A resolved address is always a **display convenience**, never an authoritative location source — the recorded observation's coordinates are always what was actually captured or placed. `reverse_geocode_cache` has RLS enabled with zero policies (deny-all except service-role), since no human role has a legitimate reason to read this infrastructure table directly.

## Offline sync path

Location capture is fully offline-first, matching the rest of the report submission flow:

1. `GpsStep`/`ManualLocationStep` write to `draft.location` (client-only, `ReportDraft` in IndexedDB).
2. `SubmitStep` hands the whole draft to the Dexie offline queue (`repository.submitDraft`).
3. `lib/offline/sync-replay.ts`'s `syncOneItem` — the single shared replay implementation every sync trigger calls — POSTs the report, then evidence (if any), then **the location** (if any), in that order, only once the report row is confirmed to exist server-side. A `location_synced` boolean on the queue item (mirroring `evidence_blob_id`'s clear-after-confirm pattern) prevents a retried sync pass from recording a duplicate observation for the same draft.
4. Because report creation and location capture are decoupled across an asynchronous sync boundary, **there is no synchronous point where a server-computed boundary warning can interrupt the Reporter's submission flow** — and per this block's explicit requirement, it must not. The boundary/suspicious-pattern signals are Verifier-facing only, not Reporter-facing, in this block's scope.

## Verifier display

`apps/web/src/components/verifier/LocationTrustPanel.tsx` shows, per observation: source (GPS / manual pin / manual address), a read-only map with accuracy circle, capture timestamp, device-reported accuracy, distance to the event's geofence centroid, boundary status, the confidence signal (via the existing `ConfidenceMeter` primitive), and any suspicious-pattern flags with plain-language explanations. The most recent observation is shown expanded; earlier ones (if a Reporter retried GPS) are collapsed but available.

No dedicated Verifier report-detail screen exists yet (`/verifier/laporan` remains a BLOCK 11 navigation stub — the real queue/detail UI is a later block's scope, per the precedent set in BLOCK 15/16). `LocationTrustPanel` and its backing `GET /api/reports/:reportId/location` route are the data-correct, RBAC-correct pieces ready to drop into that future screen — building a full Verifier queue UI here would be premature scope for a location-capture block.

## Known limitations

- `confidence_signal` is a simple, hand-tuned heuristic, not a calibrated statistical model — its purpose is a rough, explainable corroboration signal, not a probability.
- Reverse geocoding requires a configured `MAPTILER_API_KEY`; without one, no address resolution happens anywhere (the null fallback), which is the correct, honest behavior rather than a synthesized placeholder.
- The map tile provider (MapTiler, via `NEXT_PUBLIC_MAP_STYLE_URL`) is a single point of failure for the *visual* map — `MapPin` degrades to a coordinate-only text fallback on load failure, and the manual-location step's numeric inputs remain fully functional without the map ever loading, per RISK_REGISTER.md risk #7.
- No live Supabase/PostGIS instance was reachable this session — the RPC's actual runtime behavior (coordinate insertion, distance computation, generated columns) is reviewed manually and exercised only via mocked Postgres-error-code translation in the domain-service unit tests, consistent with every prior block's stated limitation.
