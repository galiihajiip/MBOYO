# MBOYO — Backup & Disaster Recovery Guide

This guide details backup schedules, storage snapshot policies, and restoration runbooks for the **MBOYO** PostgreSQL PostGIS database and private evidence storage buckets.

---

## 1. Backup Policies

| Asset | Type | Schedule | Retention | Storage Location |
| :--- | :--- | :--- | :--- | :--- |
| **PostgreSQL PostGIS DB** | Full Dump | Daily at 02:00 UTC | 30 days | Encrypted S3 Bucket |
| **WAL Logs (PITR)** | Continuous | Every 5 minutes | 7 days | Supabase Managed Cloud |
| **Report Evidence Storage** | Bucket Replication | Real-time cross-region | Indefinite | Multi-region Storage |
| **Model Registry Weights** | Immutable Artifacts | Per version release | Versioned | Artifact Storage |

---

## 2. PostgreSQL Backup Procedures

### Manual Database Dump
```bash
pg_dump -h 127.0.0.1 -p 54322 -U postgres -d postgres -F c -b -v -f mboyo_backup_$(date +%Y%m%d_%H%M%S).dump
```

### Manual Backup Verification
```bash
pg_restore --list mboyo_backup_*.dump | head -n 20
```

---

## 3. Database Restore Runbook

To restore from a SQL/dump file into a fresh target environment:

```bash
# 1. Drop existing connections
psql -h 127.0.0.1 -p 54322 -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'postgres' AND pid <> pg_backend_pid();"

# 2. Restore database schema & PostGIS data
pg_restore -h 127.0.0.1 -p 54322 -U postgres -d postgres --clean --if-exists mboyo_backup_*.dump

# 3. Run PostGIS sanity check
psql -h 127.0.0.1 -p 54322 -U postgres -c "SELECT PostGIS_Full_Version();"
```

---

## 4. Evidence Bucket Recovery

In the event of accidental object deletion in `report-evidence`:

1. Restore from point-in-time storage snapshot via Supabase Storage Management CLI.
2. Validate SHA-256 hashes against `report_evidence` table in Postgres.
