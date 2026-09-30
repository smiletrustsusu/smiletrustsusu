# Production go-live guide (Section 6)

Use this checklist before handling **real customer money** with Smile Trust Susu v3.2+.

Architecture: shared SPA + Capacitor (Android) + Electron (Windows). Do **not** rewrite as Next.js or Jetpack Compose.

---

## Phase A — Backup and database (Day 1)

### A1. Back up existing data
1. Open the app as **Manager (JOHN)** / System Owner.
2. Go to **Backup & Restore**.
3. Export a full backup JSON file.
4. Copy the file to a USB drive or cloud storage (not only on one PC).

### A2. Create Supabase project
1. Go to [supabase.com](https://supabase.com) → New project.
2. Save the **Project URL** and **anon public key** (Settings → API).

### A3. Run SQL migrations (in order)
In Supabase → **SQL Editor**, run each file completely. Repo path: `supabase/`.

| Order | File | Purpose |
| --- | --- | --- |
| 0 | `supabase/rls.sql` | Legacy cloud snapshot table + RLS (optional; 046 creates the table if missing) |
| 1 | `supabase/migrations/001_financial_core.sql` | Relational financial core |
| 2 | `supabase/migrations/002_susu_groups_pesewas.sql` | Susu groups + pesewas columns |
| 3 | `supabase/migrations/003_rls_rpc_production.sql` | Production RLS / RPC templates |
| 4 | `supabase/migrations/004_savings_products.sql` | Savings products |
| 5 | `supabase/migrations/005_production_auth_rls.sql` | Auth email, MFA hooks, RLS |
| 6 | `supabase/migrations/006_web_admin_compat.sql` | Admin list RPCs / branch code |
| 7 | `supabase/migrations/007_agency_platform.sql` | Agency platform + role CHECK expansion |
| 8 | `supabase/migrations/008_customer_crm.sql` | Customer CRM extensions |
| 9 | `supabase/migrations/009_agent_ops.sql` | Agent operations |
| 10 | `supabase/migrations/010_branch_ops.sql` | Branch HQ extensions |
| 11 | `supabase/migrations/011_collection_ops.sql` | Collection ops extensions |
| 12 | `supabase/migrations/012_group_ops.sql` | Group susu extensions |
| 13 | `supabase/migrations/013_loan_status.sql` | Loan status history |
| 14 | `supabase/migrations/014_withdrawal_ops.sql` | Withdrawal extras |
| 15 | `supabase/migrations/015_accounting_ops.sql` | Accounting extras |
| 16 | `supabase/migrations/016_report_ops.sql` | Reports / analytics |
| 17 | `supabase/migrations/017_notification_ops.sql` | Notification extras |
| 18 | `supabase/migrations/018_notification_thresholds.sql` | Threshold config versions |
| 19 | `supabase/migrations/019_canonical_schema.sql` | Canonical schema overlays |
| 20 | `supabase/migrations/020_audit_ops.sql` | Audit extras |
| 21 | `supabase/migrations/021_idempotency.sql` | Idempotency key store |
| 22 | `supabase/migrations/022_system_config.sql` | System administration |
| 23 | `supabase/migrations/023_offline_sync.sql` | Offline sync tables |
| 24 | `supabase/migrations/024_identifier_standard.sql` | Identifier / aggregate versions |
| 25 | `supabase/migrations/025_payments.sql` | Payment engine |
| 26 | `supabase/migrations/026_payment_lifecycle.sql` | Payment lifecycle |
| 27 | `supabase/migrations/027_documents.sql` | Document engine |
| 28 | `supabase/migrations/028_jobs.sql` | Scheduler / background jobs |
| 29 | `supabase/migrations/029_monitoring.sql` | Monitoring / device health |
| 30 | `supabase/migrations/030_monitoring_policy.sql` | Alert policy versions |
| 31 | `supabase/migrations/031_api_gateway.sql` | API gateway registry |
| 32 | `supabase/migrations/032_backup_recovery.sql` | Backup / DR |
| 33 | `supabase/migrations/033_security_contracts.sql` | Security contracts |
| 34 | `supabase/migrations/034_api_schema.sql` | Global API schema registry |
| 35 | `supabase/migrations/035_workflow_engine.sql` | Workflow engine |
| 36 | `supabase/migrations/036_workflow_contracts.sql` | Workflow public contracts |
| 37 | `supabase/migrations/037_rule_engine.sql` | Rule engine |
| 38 | `supabase/migrations/038_data_exchange.sql` | Data exchange |
| 39 | `supabase/migrations/039_digital_records.sql` | Digital records / ECM |
| 40 | `supabase/migrations/040_enterprise_bi.sql` | Enterprise BI registries |
| 41 | `supabase/migrations/041_enterprise_integration.sql` | Integration hub |
| 42 | `supabase/migrations/042_enterprise_ai.sql` | Enterprise AI stubs |
| 43 | `supabase/migrations/043_platform_admin.sql` | Platform administration |
| 44 | `supabase/migrations/044_wave2_database_platform.sql` | Wave 2 DB platform hardening |
| 45 | `supabase/migrations/045_app_users_role_rbac_align.sql` | Additive `app_users.role` CHECK ↔ JS RBAC (GAP-010) |
| 46 | `supabase/migrations/046_server_side_authorization.sql` | Server-side authorization. **Cutover only**: apply as step 4 of [`docs/SECURITY-CUTOVER.md`](docs/SECURITY-CUTOVER.md), after the new builds are installed |

If a migration fails, note the line number, fix duplicates (safe `IF NOT EXISTS` / `DROP CONSTRAINT IF EXISTS` blocks), and do **not** proceed until the ordered list succeeds.

**Money note:** JS SoT is integer **pesewas** (`src/core/money.js`). SQL still has legacy `numeric(14,2)` GHS columns with generated/companion pesewas — see `docs/money-dual-model-plan.md` (GAP-005). Do not change live posting math during cutover.

### A4. Configure the app
1. Copy `config.example.json` → `config.json`.
2. Set:
   - `supabaseUrl` — your project URL
   - `supabaseAnonKey` — anon key
   - Only the public settings shown in `config.example.json`. Passwords, sync keys, sync tokens, service-role keys and webhook secrets must **not** go in `config.json`; it ships inside the APK/EXE and `npm run prepare:web` refuses to build if they are present.
   - Deploy the `staff-login` Edge Function and apply migration `046_server_side_authorization.sql` following [`docs/SECURITY-CUTOVER.md`](docs/SECURITY-CUTOVER.md). The service-role key is set only as an Edge Function secret.
3. In app **Settings** (Manager):
   - Paste Supabase URL + anon key
   - Set **Cloud Mode** → Supabase
   - Enable **Relational PostgreSQL sync**
   - Enable **Encrypt offline queue**
   - Leave **Production mode** OFF until Phase C pilot passes

---

## Phase B — Security hardening (Day 1–2)

### B1. Passwords
- [ ] Change Manager password (Settings → Change Owner Password).
- [ ] Create unique passwords for every Collector and Assistant Manager.
- [ ] Disable developer login (`allowDeveloperLogin: false` in config — default in EXE/APK).

### B2. Devices
- [ ] Each collector signs in once on their phone (registers device).
- [ ] Manager → **Settings → Registered Devices** — verify labels.
- [ ] Test **Disable** on a spare device; confirm login is blocked.

### B3. Staff and permissions
- [ ] Create collectors with permanent **collector codes**.
- [ ] Assign customers to collectors (automatic on registration).
- [ ] Configure collector screen permissions (Permissions screen).
- [ ] Create **Auditor** account if external review is needed (read-only).

### B4. Financial controls (verify in app)
- [ ] Record a test collection → unique receipt number appears.
- [ ] Try to edit collection → blocked; use **Reverse** instead.
- [ ] Record MoMo with duplicate reference → blocked.
- [ ] Submit collector **Cash Handover** → Manager verifies counted cash.
- [ ] Request reversal on withdrawal/loan repayment → appears in **Approvals**.
- [ ] Confirm interest default **15**, collection days **31**, cashier float **GHS 1000**.

---

## Phase C — Pilot branch (2–4 weeks)

Run **one branch only** with small amounts or simulated cash:

| Day | Task |
| --- | --- |
| Daily | Collectors record payments; Manager verifies MoMo references |
| Daily | Each collector submits cash handover; Manager counts physical cash |
| Daily | **Sync now** on all devices; confirm no duplicate receipts |
| Weekly | Review **Audit Trail** and **Exceptions** |
| Weekly | Run group contribution report; check arrears |
| End | Create susu group distribution → approve → mark paid |

### Enable production mode (after pilot)
When pilot reconciles cleanly:
1. Settings → enable **Production mode**.
2. Production mode **blocks** financial writes if relational sync is off or developer login is on.
3. Rebuild and deploy EXE/APK: `npm run build:exe` / `npm run build:apk`.

Human gates (Wave 9 HA-*, cutover CO-*, PV-*, CERT-001) remain **PendingHumanSignOff** until owners sign — see `docs/backlog/human-gates-runbook.md`. Do not treat FrameworkReady as live certified.

---

## Phase D — PostgreSQL as source of truth (ongoing)

Current state (v3.2):
- **Relational sync** dual-writes collections to Supabase RPC `record_collection_from_client`.
- **Snapshot sync** still runs for full-state backup during migration.
- Full cutover requires:
  1. Supabase Auth with JWT claims (`business_id`, `role`, `user_id`)
  2. Enable RLS policies (templates in migration 003 comments)
  3. One-time import script: snapshot JSON → relational rows (`npm run import:relational`)
  4. Disable snapshot-only mode; set `productionMode` + `relationalSync` only

---

## Phase E — Remaining items (post framework)

| Item | Status | Action |
| --- | --- | --- |
| Supabase Auth + MFA | Planned | Prove enroll/challenge in UAT + PV (GAP-015) |
| Customer portal | Future | Separate web app |
| MoMo provider callbacks | Planned | Edge Function; align amounts to pesewas (GAP-019) |
| Full pesewas migration | Partial | See `docs/money-dual-model-plan.md` (GAP-005) |
| Encrypted cloud snapshots | Planned | Encrypt payload before upload |
| Android reproducible APK | Partial | `android/README.md` + `cap:add:android` (GAP-004) |
| EXE signing + update feed | Partial | `docs/wave6-windows-exe.md` + env certs (GAP-008) |
| CI | Partial | `.github/workflows/ci.yml` (GAP-007); remote still org-owned |

---

## Quick reference commands

```powershell
cd "C:\Users\kingb\Documents\SMILE TRUST SUSU MANAGEMENT SYSTEM"
npm test
npm run validate:rc
npm run prepare:web
npm run build:exe
npm run build:apk
```

---

## Emergency rollback

1. Stop all collectors from recording new payments.
2. Restore from latest Backup JSON (Backup & Restore → Import).
3. Disable production mode in Settings.
4. Contact support if PostgreSQL and local data diverge — use audit log + receipt numbers to reconcile.

---

## Support contacts

Document your own:
- Manager name and phone
- IT / Supabase admin
- Bank / MoMo reconciliation contact

**Never put passwords or privileged keys in `config.json` or any client build.**
