# MBOYO — Production Deployment Specification

This document details the deployment topology, container specifications, and release orchestration for the **MBOYO** platform.

---

## 1. Deployment Topology

```text
                                [ Internet / End-Users ]
                                           │
                                           ▼
                              [ Vercel Edge / Cloudflare ]
                                           │
                                           ▼
                                    [ Next.js BFF ]
                                   (apps/web - PWA)
                                     │          │
                     ┌───────────────┘          └───────────────┐
                     ▼                                          ▼
           [ Supabase Managed ]                         [ Internal VPC ]
    ┌──────────────────────────────┐                           │
    │  - PostgreSQL + PostGIS      │                           ▼
    │  - Supabase Auth             │                   [ FastAPI ML API ]
    │  - Storage (Private Buckets) │                  (apps/ml-api ONNX)
    │  - Realtime Engine           │                           ▲
    └──────────────────────────────┘                           │
                     ▲                                         │
                     └──────────────── [ Python Worker ] ──────┘
                                      (apps/worker Job Queue)
```

---

## 2. Infrastructure Provider Matrix

| Component | Provider / Platform | Hosting Model | Auto-scaling |
| :--- | :--- | :--- | :--- |
| **apps/web** | Vercel / Docker Container | Serverless / Container | Auto-scale on request volume |
| **apps/ml-api** | Google Cloud Run / Railway / Fly.io | Stateless Container | Scale 1 to N (Min instances: 1) |
| **apps/worker** | AWS ECS / Railway / Render Worker | Stateful Background Daemon | Fixed replica set (2 instances min) |
| **Database & Storage** | Supabase Platform | Managed Cloud Postgres | Primary DB + Read Replica |
| **Map Tiles** | MapTiler / MapLibre Vector | CDN | Edge cached |

---

## 3. Container Specifications

### `apps/web` Dockerfile
Multi-stage build using Node.js Alpine base, installing standalone Next.js build output.

### `apps/ml-api` Dockerfile
Python 3.12 Slim base image with ONNX Runtime CPU & OpenCV runtime dependencies installed as non-root user (`appuser`).

### `apps/worker` Dockerfile
Python 3.12 Slim base image executing `python -m worker.main` with automated health check heartbeat.

---

## 4. Deployment Order & Release Protocol

1. **Database Migrations**: Apply Supabase SQL migrations via CLI:
   ```bash
   supabase db push --linked
   ```
2. **ML API Microservice**: Deploy updated `ml-api` container & verify `/ready` health check returns 200 OK.
3. **Background Worker**: Deploy updated worker pool.
4. **Next.js Web BFF**: Deploy frontend PWA build to Vercel/container.
5. **Post-Deployment Verification**: Run automated synthetic smoke tests against `/api/health`.
