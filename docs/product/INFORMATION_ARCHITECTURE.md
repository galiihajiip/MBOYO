# MBOYO Information Architecture

This document is the map-level view of every screen in MBOYO, organized by audience. [SCREEN_INVENTORY.md](SCREEN_INVENTORY.md) gives the full per-screen specification (role, route, purpose, data, CTAs, edge states, responsive hierarchy) for every screen listed here. Together with [CONTENT_GUIDE.md](CONTENT_GUIDE.md) and [STITCH_HANDOFF.md](STITCH_HANDOFF.md), these four documents are the **Google Stitch design source of truth** — no screen should be designed in Stitch that isn't listed here, and no screen listed here should be implemented in code before its Stitch design is approved, per the Design Gate in [DELIVERY_ROADMAP.md](DELIVERY_ROADMAP.md).

This document does not implement screens — it is a specification for design.

## Site Map by Audience

### Public (unauthenticated)
- Landing page (header, hero, footer as regions within it)
- Login
- Register
- Password reset request
- Password reset confirmation
- Public help/about (linked from footer)

### Reporter
- Beranda (home)
- Buat Laporan (report wizard — multi-step)
- Antrean Offline (offline queue)
- Laporan Saya (my reports list)
- Laporan Saya — detail (own report detail)
- Bantuan (help)
- Profil (own profile)

### Verifier
- Ringkasan (summary dashboard)
- Antrean Verifikasi (verification queue)
- Antrean Verifikasi — detail (report review/decision screen)
- Peta Bukti (evidence map)
- Semua Laporan (all reports list)
- Permintaan Informasi (information requests list)
- Notifikasi (notifications)
- Profil (own profile)

### Response Coordinator
- Command Center (dashboard)
- Peta Krisis (crisis map)
- Prioritas (priority workflow)
- Tugas Respons (task list)
- Tugas Respons — detail (task detail/assignment)
- Analitik (analytics dashboard)
- Ekspor (export)
- Notifikasi (notifications)
- Profil (own profile)

### System Administrator
- Administrasi (org overview)
- Pengguna & Role (users and roles)
- Event Bencana (disaster events)
- Aturan Eskalasi (escalation rules)
- Integrasi (integrations)
- Kesehatan Sistem (system health)
- Pengaturan (settings)
- Profil (own profile)

### Auditor
- Audit Trail
- Laporan Read-Only (read-only report browser)
- Model Registry
- Evaluasi Model (model evaluations)
- Export Compliance
- Retensi Data (data retention)
- Profil (own profile)

### System-State / Cross-Cutting Screens
- PWA install prompt
- PWA update-available prompt
- Global offline banner (not offline-first, this is the persistent connectivity indicator)
- Session expired / re-authenticate
- Unauthorized (403) — role-mismatch screen
- Not found (404)
- Generic error (500 / unhandled)
- Maintenance mode

## Navigation Shells

Each authenticated role has one persistent navigation shell containing exactly the items defined in [NAVIGATION_BY_ROLE.md](NAVIGATION_BY_ROLE.md) — no more, no fewer. The shell renders as:
- **Desktop:** persistent left sidebar + top bar (notifications, profile menu).
- **Tablet:** collapsible left sidebar (icon-only by default, expandable) + top bar.
- **Mobile:** bottom tab bar for the 4–5 most-used items + "More" overflow sheet for the rest, top bar reduced to page title + notification/profile icons.

Public pages use a lightweight header (logo, login/register CTA) and footer (links, language note — Bahasa Indonesia only, no language switcher at MVP) instead of a role shell.

## Design-Token and Brand Reference

All screens in [SCREEN_INVENTORY.md](SCREEN_INVENTORY.md) use the brand tokens (Primary Ink Navy, Deep Ocean, Signal Cyan, Relief Teal, Safe Green, Caution Amber, Priority Orange, Critical Red, severity palette) and typography (Plus Jakarta Sans UI, IBM Plex Mono for IDs/coordinates/model versions/metrics) defined in the project's design spec. Severity and priority values must always render with their designated color (e.g., `destroyed` = Critical Red, `critical` priority = Critical Red) — a screen must never invent an ad hoc color for a severity/priority value already tokenized.

## Cross-Reference Discipline

- Every screen in [SCREEN_INVENTORY.md](SCREEN_INVENTORY.md) traces to at least one entity in [DOMAIN_MODEL.md](DOMAIN_MODEL.md) and, where it performs a mutating action, to an explicit RBAC allowance in [RBAC_MATRIX.md](RBAC_MATRIX.md) — a screen must never show a call-to-action for an action the matrix forbids for that role.
- State-dependent screens (e.g., Verifier's report review screen) must reflect exactly the states defined in [STATE_MACHINES.md](STATE_MACHINES.md) — no screen should imply a report/task status that doesn't exist in that model.
- [STITCH_HANDOFF.md](STITCH_HANDOFF.md) sequences which screens to generate first in Google Stitch and what must be true before implementation begins.
