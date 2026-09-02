# ORBIT — Database Backup & Disaster Recovery Guide

This document outlines the backup procedures, disaster recovery protocols, and database isolation rules for the ORBIT platform.

---

## 1. Backup Strategy

ORBIT stores all tenant configurations, AI employee states, usage ledgers, and conversations in MongoDB.

### Primary: MongoDB Atlas Automated Backups
- **Recommended Tier**: Dedicated cluster (M10 or higher).
- **Snapshot Frequency**: Continuous / Daily automated snapshots.
- **Retention**: Minimum 7 days (30 days recommended for audit compliance).
- **Point-in-Time Recovery (PITR)**: Supported on Atlas M10+ clusters for restoring database state to any exact minute within the retention window.

---

## 2. CLI-Based Backup Procedure (`mongodump`)

For off-site archiving or pre-maintenance snapshots:

```bash
# Export complete production database
mongodump --uri="mongodb+srv://<admin_user>:<password>@cluster0.xxx.mongodb.net/orbit_prod?retryWrites=true&w=majority" \
          --archive="orbit_backup_$(date +%Y%m%d_%H%M%S).gz" \
          --gzip
```

### Critical Collections Included:
- `tenants`: Tenant profiles and status
- `users`: User credentials and session states
- `ai_employees`: AI employee configurations and lifecycle states
- `channels`: Telephony and WhatsApp channels
- `business_integrations`: Integration definitions and metadata
- `tools`: Registered capability tools
- `tenant_live_data`: Manual business rates, operating hours, policies
- `tenant_pricing`: Commercial billing rules and markup
- `usage_ledger`: Unbilled and billed usage events
- `invoices`: Immutable financial invoices
- `conversations`: Sanitized call recordings, durations, transcripts
- `audit_log`: Admin operation logs

---

## 3. CLI-Based Restore Procedure (`mongorestore`)

> ⚠️ **CAUTION**: Never run restore against a shared or live database without verifying the target namespace.

```bash
# Restore backup archive to target database
mongorestore --uri="mongodb+srv://<admin_user>:<password>@cluster0.xxx.mongodb.net/?retryWrites=true&w=majority" \
             --nsInclude="orbit_prod.*" \
             --archive="orbit_backup_20260819_120000.gz" \
             --gzip \
             --drop
```

---

## 4. Disaster Recovery & Safety Rules

1. **Strict Database Name Separation**:
   - Production database name must be distinct (e.g., `orbit_prod`).
   - The backend explicitly refuses to start if `ORBIT_ENV=production` is paired with `DB_NAME=orbit_dev` or `test_database`.
2. **Cleanup Safety Guard**:
   - `cleanup_test_data.py` has a hardwired refusal guard that rejects execution if `ORBIT_ENV=production` or if production tenants are detected.
3. **Index Re-creation**:
   - Database indexes (unique indexes on `users.email`, `ai_employees.provider_agent_id`, `channels.connected_identifier`, `usage_ledger.idempotency_key`) are automatically validated and re-created upon server startup via `create_indexes()`.
