# MBOYO Stitch Handoff

This document sequences how [INFORMATION_ARCHITECTURE.md](INFORMATION_ARCHITECTURE.md), [SCREEN_INVENTORY.md](SCREEN_INVENTORY.md), and [CONTENT_GUIDE.md](CONTENT_GUIDE.md) get translated into Google Stitch designs, and defines the Design Gate referenced in [DELIVERY_ROADMAP.md](DELIVERY_ROADMAP.md). No screen may be implemented in code before it has an approved Stitch design produced against this handoff.

## Purpose

Stitch is where MBOYO's screens get their first visual form. This document is not a design itself — it is the brief that makes every Stitch generation session consistent with the specification already locked in BLOCKS 00–04, so design work doesn't silently drift from the RBAC, state-machine, and content rules already established.

## Inputs Every Stitch Session Must Reference

1. **[SCREEN_INVENTORY.md](SCREEN_INVENTORY.md)** — the specific screen's full spec (role, route, data, CTAs, forbidden actions, all edge states, responsive hierarchy). Generate to this spec exactly — a Stitch design must not add a control the spec's "Forbidden Actions" section excludes, and must not omit a state the spec requires (loading/empty/error/offline all need a designed state, not just the happy path).
2. **[CONTENT_GUIDE.md](CONTENT_GUIDE.md)** — canonical Bahasa Indonesia terminology, severity/priority/status labels and their color mappings, and the two mandatory disclosure strings (demo mode, advisory-only model output). Use these labels verbatim in the design; do not paraphrase.
3. **Brand tokens and typography** — the color palette (Primary Ink Navy, Deep Ocean, Signal Cyan, Relief Teal, Safe Green, Caution Amber, Priority Orange, Critical Red, severity palette), Plus Jakarta Sans (UI) and IBM Plex Mono (IDs, coordinates, model versions, metrics) from the project's design spec.
4. **[NAVIGATION_BY_ROLE.md](NAVIGATION_BY_ROLE.md)** — the exact nav shell (items, order, labels) for the role the screen belongs to.
5. **[RBAC_MATRIX.md](RBAC_MATRIX.md)** — cross-check that every interactive element on the screen maps to an allowed action for that role; if a Stitch generation produces an affordance not backed by the matrix, remove it before requesting approval.

## Generation Sequence

Screens are generated in dependency order — shared shell/pattern screens first, then role by role, so later screens can reuse approved components rather than each screen reinventing its own nav shell or card pattern.

### Phase A — Shell and Shared Patterns

1. Public shell: Landing page (header, hero, footer regions), Login, Register, Password Reset (request + confirmation).
2. Authenticated app shell: one desktop/tablet/mobile nav shell per role variant (5 shells), built from [NAVIGATION_BY_ROLE.md](NAVIGATION_BY_ROLE.md).
3. Shared pattern screens: Profil (one design adapted per role's data), Notifikasi (Verifier/Coordinator variants).
4. System-state screens: PWA install/update prompts, Global Offline Banner, Session Expired, Unauthorized (403), Not Found (404), Generic Error (500), Maintenance Mode.

Exit criterion for Phase A: the five nav shells and all system-state screens are approved before any role-specific work screen is generated, since nearly every subsequent screen is a shell + content-area composition.

### Phase B — Reporter Screens

Beranda → Buat Laporan (all four wizard steps) → Antrean Offline → Laporan Saya (list) → Laporan Saya (detail) → Bantuan.

Reporter screens are sequenced first among role-specific work because the [MVP live flow](PRODUCT_CHARTER.md#the-mvp-live-flow) begins here, and because Buat Laporan's offline/mobile-first requirements are the most constraining design problem — solving it early surfaces layout patterns (bottom action bars, large touch targets, persistent offline indicators) reused by later mobile layouts.

### Phase C — Verifier Screens

Ringkasan → Antrean Verifikasi (list) → Antrean Verifikasi (detail/decision screen) → Peta Bukti → Semua Laporan → Permintaan Informasi.

The detail/decision screen is the highest-stakes design in the entire product (per [SCREEN_INVENTORY.md](SCREEN_INVENTORY.md), "the single most consequential action in the product") — allocate the most design iteration here, specifically validating that the decision panel is persistently reachable on mobile (bottom action bar) and that the advisory-only/demo-mode disclosure strings are visually impossible to miss.

### Phase D — Response Coordinator Screens

Command Center → Peta Krisis → Prioritas → Tugas Respons (list) → Tugas Respons (detail) → Analitik → Ekspor.

Peta Krisis requires explicit attention to the map-failure fallback (list view) — both states must be designed, not just the map's happy path, per [RISK_REGISTER.md](../product/RISK_REGISTER.md) risk #7.

### Phase E — System Administrator Screens

Administrasi → Pengguna & Role → Event Bencana → Aturan Eskalasi → Integrasi → Kesehatan Sistem → Pengaturan.

Design review for this phase must explicitly verify no screen contains a validate/dispatch affordance, per the acceptance criterion carried through from [RBAC_MATRIX.md](RBAC_MATRIX.md) — this is a specific check to run during Stitch review, not just an implementation-time concern.

### Phase F — Auditor Screens

Audit Trail → Laporan Read-Only → Model Registry → Evaluasi Model → Export Compliance → Retensi Data.

Design review for this phase must explicitly verify **zero** mutating controls anywhere (no edit icon, no delete icon, no save button on any screen in this phase) — this is the strictest review pass of the six phases, since Auditor read-only-ness is a hard product guarantee, not a soft default.

## What "Approved" Means

A Stitch design is approved for a given screen only when all of the following hold — this is the Design Gate exit criterion referenced in [DELIVERY_ROADMAP.md](DELIVERY_ROADMAP.md):

1. Every state listed in that screen's [SCREEN_INVENTORY.md](SCREEN_INVENTORY.md) entry has a corresponding design — loading, empty, error, and (where applicable) offline and permission-denied states are not optional extras designed later; they are part of the same approval.
2. Every interactive element traces to an action permitted for that role in [RBAC_MATRIX.md](RBAC_MATRIX.md); nothing in the "Forbidden Actions" list for that screen appears as a control.
3. All copy uses [CONTENT_GUIDE.md](CONTENT_GUIDE.md) canonical terms, including the two mandatory disclosure strings wherever their trigger condition is designed for.
4. The three responsive breakpoints (desktop/tablet/mobile) specified in the screen's "Responsive Hierarchy" are all designed, not just the desktop version with an assumption that smaller breakpoints will "just reflow."
5. Severity and priority values use their designated color token consistently with [CONTENT_GUIDE.md](CONTENT_GUIDE.md), and never rely on color alone without the accompanying label (accessibility).
6. The user (not Claude Code, not an agent) has explicitly signed off on the design — this gate is a human decision point by design, consistent with the "How to Use" instruction that Google Stitch designs must be generated and approved before implementation blocks begin.

## What Happens on Deviation

If, during Stitch generation, a screen's real design reveals that the [SCREEN_INVENTORY.md](SCREEN_INVENTORY.md) spec was wrong, incomplete, or in conflict with the RBAC matrix or state machines — that is a signal to fix the specification document first, then regenerate the design against the corrected spec. A Stitch design is never allowed to silently outrun or contradict the specification documents; if a mismatch is found, it is resolved by updating the source-of-truth document (with a corresponding entry in [WORKING_CONTRACT.md](WORKING_CONTRACT.md)'s decision log if the change is substantive), not by treating the design as an unstated amendment.

## Implementation Handoff (Beyond This Block)

Once a screen's design is approved per the criteria above, it becomes an input to the implementation blocks in [DELIVERY_ROADMAP.md](DELIVERY_ROADMAP.md) Phase 1 onward. Implementation blocks should reference the approved design plus this same set of four documents ([INFORMATION_ARCHITECTURE.md](INFORMATION_ARCHITECTURE.md), [SCREEN_INVENTORY.md](SCREEN_INVENTORY.md), [CONTENT_GUIDE.md](CONTENT_GUIDE.md), this handoff) — not just the visual design in isolation — since the spec captures RBAC/state/offline requirements that a visual design alone cannot fully convey.
