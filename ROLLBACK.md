# MBOYO — Rollback & Recovery Procedures

This guide provides step-by-step procedures for safely rolling back releases across web application, background worker, ML API, and database layers.

---

## 1. Fast Rollback Decision Matrix

| Severity Level | Trigger Condition | Target Component | Rollback Strategy | Max SLA |
| :--- | :--- | :--- | :--- | :--- |
| **SEV-1** | High error rate (>5%) on Next.js BFF | `apps/web` | Instant Vercel/CDN deployment rollback | < 5 mins |
| **SEV-1** | Worker queue deadlock or job processing crash | `apps/worker` | Redeploy previous worker image tag | < 10 mins |
| **SEV-2** | ML Model degradation or inference latency spike | `apps/ml-api` | Switch active model version flag to fallback | < 5 mins |
| **SEV-2** | Schema migration failure | Database | Execute down migration script | < 15 mins |

---

## 2. Web Application Rollback (`apps/web`)

### Vercel Instant Rollback
1. Open Vercel Dashboard -> Projects -> `mboyo-web` -> Deployments.
2. Select previous stable deployment -> Click **Promote to Production**.

### Container Rollback
```bash
# Redeploy previous image tag
docker pull ghcr.io/galiihajiip/mboyo-web:v1.0.0-previous
docker-compose up -d --no-deps web
```

---

## 3. ML API & Model Weight Rollback (`apps/ml-api`)

If a newly deployed vision model exhibits unexpected false positive rates:

1. Update `system_settings` table via Supabase SQL or Admin portal:
   ```sql
   UPDATE system_settings
   SET setting_value = jsonb_build_object('active_model_version', 'v1.0.0-stable')
   WHERE setting_key = 'ml_model_config';
   ```
2. The ML API hot-reloads model weights without downtime.
3. If necessary, revert `ml-api` container to previous tag:
   ```bash
   gcloud run deploy mboyo-ml-api --image=gcr.io/mboyo/ml-api:v1.0.0-stable
   ```

---

## 4. Database Migration Rollback

> [!WARNING]
> Database rollbacks must preserve offline citizen report data and immutable audit records. Never run destructive `DROP TABLE` operations on live production schemas.

```bash
# Revert specific migration step
supabase migration revert --step 1
```

If data corruption occurs:
1. Restore PostGIS database to Point-In-Time (PITR) state before migration.
2. Re-trigger pending offline sync queue from client devices.
