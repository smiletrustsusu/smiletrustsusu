# Apply migrations on local / UAT only (GAP-010)

**Never use this against production.** Agents and scripts must not invent DB URLs or default to a prod connection string.

Ordered set (same as `PRODUCTION.md` Phase A3):

1. `supabase/rls.sql`
2. `supabase/migrations/001_*.sql` … `045_*.sql`

---

## Safety rails

| Control | Behavior |
|---------|----------|
| Confirm flag | `--i-understand-uat-only` is **required** or the script exits |
| URL source | `SMILE_UAT_DATABASE_URL` only (required for `--apply`) |
| Prod refusal | Refuses if URL equals `SMILE_PROD_DATABASE_URL` or looks production-like |
| Default mode | Dry-run: lists files, **no** DB writes |
| Apply mode | `--apply` runs `psql -v ON_ERROR_STOP=1 -f …` in order |

There is **no** default production URL. `DATABASE_URL` alone is intentionally **not** used.

---

## Commands (PowerShell)

```powershell
# Dry-run (lists rls + 001–045)
node scripts/apply-uat-migrations.js --i-understand-uat-only

# Apply to UAT / local Postgres only
$env:SMILE_UAT_DATABASE_URL = "postgresql://USER:PASS@HOST:5432/postgres"
node scripts/apply-uat-migrations.js --i-understand-uat-only --apply

# npm alias
npm run uat:apply-migrations -- --i-understand-uat-only
npm run uat:apply-migrations -- --i-understand-uat-only --apply
```

Requires `psql` on `PATH` for `--apply`.

---

## Manual alternative (Supabase SQL Editor)

If you prefer the dashboard: open the **UAT** project → SQL Editor → paste each file from `PRODUCTION.md` in order. Do not run against the production project from an agent session.

---

## Still org-owned

- Real UAT project URL / DB password
- Post-apply staff role smoke (GAP-010)
- Production migrate remains a human cutover step after HA-* (never this script)

*scripts/apply-uat-migrations.md — UAT only*
