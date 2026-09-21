# Module 21 — Backup, Restore, Disaster Recovery & Business Continuity

This engine is the **only** backup and recovery catalog for Smile Trust. The existing Local Backup and Cloud Backup buttons remain. The engine catalogs those exports, verifies checksums, runs maker-checker restores, and executes recovery drills that **never change production collections**.

It does not post money and it does not replace `exportBackup` / cloud sync.

## Backup types

Full, incremental, differential, transaction log, snapshot, application, file, and Android offline (encrypted, device-tied queue and config only).

Schedules use Module 18 (`backup`, `backup_verify`, `recovery_test`). Retention, encryption, RTO (default 240 minutes), and RPO (default 60 minutes) are configurable.

## Restore workflow

Requested → Authorized → Approved → Validated → Executing → Verified → Reconciled → Activated.

The requester cannot approve their own production restore. A restore does not become active until verification succeeds. Test drills set `applyToProduction: false` and assert collection amounts are unchanged.

## Disaster recovery and continuity

Primary (hot) and secondary (warm) sites are seeded. Strategies: cold, warm, hot. Versioned continuity plans cover payments, collections, loans, accounting, Android offline, sync, customer service, and branch operations.

## Android

Offline backups include the sync queue, monitoring buffer, cached configuration, and local receipt metadata. They stay encrypted and bound to the registered device. Private phone content is never included.

## Monitoring

Verification failures raise Module 19 alerts (`backupFailed`). Dashboards show success rate, RTO/RPO compliance, and last drill duration.

## UI

Recovery console extras sit under the existing Backup screen. Reports extras export CSV. No new nav item.

## Implementation

- Engine: `src/core/backup-recovery-ops.js`, `src/core/backup-recovery-lifecycle.js`
- Extras: `src/ui/backup-recovery-views.js`
- Schema: `supabase/migrations/032_backup_recovery.sql`
