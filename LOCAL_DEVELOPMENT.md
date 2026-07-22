# MBOYO — Local Development Guide

Welcome to the local development guide for **MBOYO** (*"Laporan Tetap Jalan. Respons Lebih Tepat."*).

---

## 1. Prerequisites

Ensure you have the following tools installed on your system:
- **Node.js**: `v20.x` or later
- **pnpm**: `v9.x` or later (`npm i -g pnpm`)
- **Python**: `3.12.x`
- **Docker Desktop**: Running locally (for Supabase Local & container testing)
- **Git**: Latest stable release

---

## 2. Environment Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Validate environment variables:
   - For web: `NEXT_PUBLIC_APP_URL=http://localhost:3000`
   - For Supabase: Default local credentials from `supabase status`
   - For ML API: `ML_API_URL=http://localhost:8000`

---

## 3. Monorepo Architecture Overview

MBOYO is structured as a Turborepo monorepo:

- `apps/web`: Next.js 14+ App Router frontend & BFF.
- `apps/ml-api`: FastAPI Python microservice for computer vision damage triage.
- `apps/worker`: Python background worker for asynchronous job execution.
- `packages/ui`: Shared design system components & brand tokens.
- `packages/domain`: Core domain models, Zod schemas, & state transition guards.
- `packages/api-client`: Typed API client for web & backend services.
- `supabase`: Local PostgreSQL schema, PostGIS, RLS policies, & seed data.
- `ml`: Model benchmarking, dataset manifests, & PyTorch training pipelines.

---

## 4. Local Development Workflow

### Starting the Monorepo

To run all apps simultaneously:
```bash
pnpm dev
```

To run individual applications:
```bash
# Frontend Web App (Next.js)
pnpm dev:web

# ML API Microservice (FastAPI)
pnpm dev:ml

# Background Worker
pnpm dev:worker
```

### Local Supabase Commands

```bash
# Start local Supabase containers (PostgreSQL, Auth, Storage, Realtime)
pnpm db:start

# Stop local Supabase
pnpm db:stop

# Reset database & apply seed data
pnpm db:reset

# Generate TypeScript types from Supabase schema
pnpm db:types
```

---

## 5. Verification & Testing

```bash
# Run ESLint across all workspaces
pnpm lint

# Run TypeScript typechecks
pnpm typecheck

# Run unit & integration tests
pnpm test

# Run Playwright E2E tests
pnpm test:e2e
```

---

## 6. Offline Testing & PWA Debugging

- Open Chrome DevTools -> Application -> Service Workers.
- Check "Offline" box to simulate disconnected network conditions.
- Create damage reports; confirm reports are stored in IndexedDB (`mboyo-offline`).
- Uncheck "Offline" to test automatic background sync replay.
