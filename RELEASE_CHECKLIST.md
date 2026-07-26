# MBOYO — Capstone Release Gate Checklist

> **Target Release Tag:** `v1.0.0-capstone`  
> **Release Target:** VETERAN KUKUS × Hackathon Bank Indonesia 2026

---

## 🔒 Final Production Gates

### 1. Code Integrity & Hygiene
- [x] TypeScript strict typecheck passes cleanly across all packages (`pnpm typecheck`).
- [x] ESLint rules pass with zero errors (`pnpm lint`).
- [x] Shared environment validation schemas enforce strict key requirements.
- [x] No `console.log` statements containing raw credentials or user PII.

### 2. Security & RBAC Enforcement
- [x] Row Level Security (RLS) policies verified across all Supabase tables.
- [x] Auditor role confirmed strictly read-only (zero mutation endpoints).
- [x] Service-role key (`SUPABASE_SERVICE_ROLE_KEY`) excluded from all browser bundles.
- [x] Private evidence storage bucket enforces short-lived signed URLs.

### 3. PWA & Offline Invariants
- [x] Web manifest (`manifest.webmanifest`) includes valid icons, colors, & display modes.
- [x] Service worker precaches app shell and handles background sync replay.
- [x] Dexie IndexedDB (`mboyo-offline`) retains offline drafts across browser restarts.

### 4. Machine Learning & Governance
- [x] Model weights registered with explicit checksums and evaluation reports.
- [x] Grad-CAM heatmaps include non-causal visual disclaimers.
- [x] Low confidence / high entropy predictions abstain to manual review.

### 5. Deployment Readiness
- [x] Docker multi-stage images pass vulnerability scanning.
- [x] Runbooks (`LOCAL_DEVELOPMENT.md`, `DEPLOYMENT.md`, `ROLLBACK.md`) fully documented.
