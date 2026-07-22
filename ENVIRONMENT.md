# MBOYO — Environment Variable Specification

This document details all required and optional environment variables across environments (Development, Staging, Production).

---

## 1. Security Invariants

> [!CAUTION]
> - Never commit `.env` files or secret credentials to version control.
> - `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SIGNING_SECRET`, `CRON_SECRET`, and `GEMINI_API_KEY` MUST NEVER be exposed to browser bundles.
> - Client-accessible variables MUST start with `NEXT_PUBLIC_`.

---

## 2. Web App Environment Variables (`apps/web`)

| Variable Name | Required | Scope | Description | Default / Example |
| :--- | :---: | :---: | :--- | :--- |
| `NEXT_PUBLIC_APP_URL` | Yes | Client/Server | Canonical URL of the web application | `http://localhost:3000` |
| `NEXT_PUBLIC_APP_ENV` | Yes | Client/Server | Active environment (`development`, `staging`, `production`) | `development` |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Client | Public URL of Supabase project | `http://127.0.0.1:54321` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Client | Public anonymous key for client-side queries | *(generated)* |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server Only | High-privilege service key for BFF operations | *(secret)* |
| `DATABASE_URL` | Yes | Server Only | Direct PostgreSQL connection string | `postgresql://...` |
| `SUPABASE_REPORTS_BUCKET` | Yes | Server Only | Bucket name for raw damage report evidence | `report-evidence` |
| `SUPABASE_EXPORTS_BUCKET` | Yes | Server Only | Bucket name for generated audit exports | `generated-exports` |
| `ML_API_URL` | Yes | Server Only | URL of the internal ML FastAPI service | `http://localhost:8000` |
| `ML_INTERNAL_TOKEN` | Yes | Server Only | Shared secret token for ML API authentication | *(secret)* |
| `SESSION_SIGNING_SECRET` | Yes | Server Only | Secret for signing server session cookies | *(secret)* |
| `CRON_SECRET` | Yes | Server Only | Secret key for triggering system maintenance crons | *(secret)* |
| `DEMO_MODE` | No | Server Only | Enables deterministic demo data & mock fallbacks | `true` |
| `NEXT_PUBLIC_DEMO_MODE` | No | Client | Controls UI demo badge & simulation toggles | `true` |
| `GEMINI_API_KEY` | No | Server Only | Optional Google Gemini API key for verifier advisory | *(optional)* |
| `GEMINI_MODEL` | No | Server Only | Gemini model identifier | `gemini-1.5-pro` |
| `GEMINI_FALLBACK_ENABLED` | No | Server Only | Enable Gemini advisory when local ML is uncertain | `false` |

---

## 3. ML API Environment Variables (`apps/ml-api`)

| Variable Name | Required | Scope | Description | Default / Example |
| :--- | :---: | :---: | :--- | :--- |
| `APP_ENV` | Yes | Server | Runtime environment | `development` |
| `ML_INTERNAL_TOKEN` | Yes | Server | Bearer token for authenticating incoming BFF requests | *(secret)* |
| `MODEL_PATH` | Yes | Server | Path to ONNX/PyTorch model weights | `models/damage_model_v1.onnx` |
| `PORT` | No | Server | Listening port for FastAPI | `8000` |
| `ALLOWED_ORIGINS` | Yes | Server | CORS allowed origins | `http://localhost:3000` |

---

## 4. Background Worker Environment Variables (`apps/worker`)

| Variable Name | Required | Scope | Description | Default / Example |
| :--- | :---: | :---: | :--- | :--- |
| `SUPABASE_URL` | Yes | Server | Supabase endpoint | `http://127.0.0.1:54321` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server | Supabase admin secret key | *(secret)* |
| `ML_API_URL` | Yes | Server | ML service endpoint | `http://localhost:8000` |
| `ML_INTERNAL_TOKEN` | Yes | Server | Internal auth token for ML API | *(secret)* |
| `POLL_INTERVAL_SECONDS` | No | Server | Worker job queue polling interval | `5` |
