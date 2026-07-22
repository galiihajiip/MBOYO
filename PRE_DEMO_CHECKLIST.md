# MBOYO — Pre-Presentation Staging Verification Checklist

Execute this checklist 15 minutes prior to live presentation or judge walkthrough.

---

## 📋 Staging Checklist

### 1. Environment & Server Health
- [ ] Confirm `NEXT_PUBLIC_DEMO_MODE=true` is enabled in `.env`.
- [ ] Verify Next.js dev server is running on `http://localhost:3000`.
- [ ] Verify FastAPI ML API health endpoint returns `200 OK` on `http://localhost:8000/health`.
- [ ] Verify Supabase local container services are running (`pnpm db:start`).

### 2. Browser & DevTools Preparation
- [ ] Open Chrome in Incognito / Fresh Profile mode (clear previous cache/cookies).
- [ ] Open Chrome DevTools -> Application -> Service Workers (verify SW registered).
- [ ] Pre-load Quick Login demo accounts:
  - Reporter: `reporter@mboyo.demo`
  - Verifier: `verifier@mboyo.demo`
  - Coordinator: `coordinator@mboyo.demo`
  - Admin: `admin@mboyo.demo`
  - Auditor: `auditor@mboyo.demo`

### 3. Demo Data State Reset
- [ ] Execute demo seed reset via script or Admin portal:
  ```bash
  pnpm db:reset
  ```
- [ ] Confirm 50 sample reports and active disaster event exist in Command Center map (`/command/peta`).

### 4. Audio/Visual Setup
- [ ] Monitor resolution set to 1920x1080 or 1440x900.
- [ ] Browser zoom set to 100%.
- [ ] Mobile viewport emulation tested at 390px (iPhone 12/13/14).
