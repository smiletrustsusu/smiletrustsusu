# Org handoff checklist (technical → humans)

**Purpose:** Single pack for org owners to finish production-readiness items that **cannot** be invented by agents (certs, remotes, HA sign-offs, UAT DB apply).  
**Rule:** Do not flip `PendingHumanSignOff` → `Approved`, do not invent keystores/CSC, do not apply migrations on **production** from this list.

Related: [human-gates-runbook.md](./human-gates-runbook.md) · [ci-remote-connect.md](../ci-remote-connect.md) · [PRODUCTION.md](../../PRODUCTION.md) · `npm run check:prod-readiness`

---

## 1. Environment variables (exact)

### Android release signing (GAP-004)

| Variable | Required for | Notes |
|----------|--------------|-------|
| `SMILE_ANDROID_KEYSTORE_FILE` | Release APK | Absolute path to **org** keystore (copied into `android/`) |
| `SMILE_ANDROID_STORE_PASSWORD` | Release APK | Store password |
| `SMILE_ANDROID_KEY_PASSWORD` | Release APK | Defaults to store password if unset |
| `SMILE_ANDROID_KEY_ALIAS` | Release APK | Default alias: `smiletrust` |
| `SMILE_ANDROID_ALLOW_LOCAL_KEYSTORE` | Pilot only | Set `1` only for local pilot keystore — **never** ship to Play |

```powershell
# Check only (no invent):
npm run setup:android-signing -- --check-only
npm run release:android
```

### Electron / Windows signing + updater (GAP-008)

| Variable | Required for | Notes |
|----------|--------------|-------|
| `CSC_LINK` or `WIN_CSC_LINK` | Signed EXE | Path or URL to org code-signing cert |
| `CSC_KEY_PASSWORD` | Signed EXE | Cert password when needed |
| `SMILE_UPDATE_FEED_URL` | Auto-update | Real feed host — **not** `example.com` / `example.invalid` |

```powershell
npm run check:electron-signing
npm run check:electron-signing -- --strict
```

### Supabase / app config (UAT)

Configure via `config.json` (from `config.example.json`) — typically:

| Key / secret | Where | Notes |
|--------------|-------|-------|
| `supabaseUrl` | `config.json` | UAT project URL |
| `supabaseAnonKey` | `config.json` | anon public key |
| Service role / DB URL | Org vault only | Never commit; not required for SPA pilot |

---

## 2. Git remote + CI (GAP-007)

```powershell
git status
git remote -v
# When org repo exists (replace placeholders — do not invent hosts):
# git remote add origin https://github.com/<ORG>/<REPO>.git
# git branch -M main
# git push -u origin main
```

After push: GitHub **Actions** → workflow **CI**, or `gh run list`. Local parity:

```powershell
npm ci
npm run prepare:web
npm run check:channels
npm test
npm run validate:rc
npm run validate:pilot
npm run hash:artifacts
npm run check:prod-readiness
```

---

## 3. Migrations 001–045 — **UAT only** (not prod)

Ordered list lives in [PRODUCTION.md](../../PRODUCTION.md) (`rls.sql` + `001`…`045`).

1. Open **UAT** Supabase → SQL Editor.  
2. Apply in order through `045_app_users_role_rbac_align.sql`.  
3. Smoke: staff role inserts / login as JOHN (System Owner).  
4. **Do not** apply on production until Wave 10 human cutover (CO-05) with backup (CO-02).

---

## 4. HA-* who signs what (Wave 9 → Wave 10)

All remain `PendingHumanSignOff` until humans sign. HG-01 deferred; HG-02…04 packs prepared; **HG-05 current focus**.

| Gate | Who signs | Evidence / recorder |
|------|-----------|---------------------|
| **HA-PO** / **HA-QA** | Product Owner / QA Lead | HG-01 UAT (deferred) — [wave9-uat-execution-guide.md](../uat/wave9-uat-execution-guide.md) |
| **HG-02** | Training owner | [wave9-training-execution-guide.md](../training/wave9-training-execution-guide.md) |
| **HA-RECON** / **HA-FIN** | Finance / Recon | [wave9-financial-recon-execution-guide.md](../reconciliation/wave9-financial-recon-execution-guide.md) |
| **HA-SEC** | Security Governance | [wave9-security-acceptance-execution-guide.md](../security/wave9-security-acceptance-execution-guide.md) |
| **HA-EXEC** / **HA-W9-EXEC** | Executive Sponsor | HG-05 — [wave9-executive-sponsor-execution-guide.md](../governance/wave9-executive-sponsor-execution-guide.md) · login **JOHN** |
| **HA-AA** / **HA-RM** | Accountable Authority / Release Manager | Wave 10 readiness / cutover authorize |
| **CO-01…CO-13** | Per-step ownerRole | [wave10-production-golive.md](../wave10-production-golive.md) · local timestamps: `npm run wave10:cutover-record` (rehearsal only — not Accepted) |

Never auto-approve from packs or agents. After HG-05 path, **Wave 10 cutover still blocked** until approvals are real.

---

## 5. Readiness dashboard (no gate flips)

**Default:** `npm run check:prod-readiness` does **not** execute `npm test` — the tests row stays **Partial** (“files present”).  
**To execute tests:** `npm run check:prod-readiness -- --run-tests` (slower; use for release gates).

```powershell
npm run check:prod-readiness
npm run check:prod-readiness -- --run-tests
```

Writes `docs/release-evidence/prod-readiness-check.json`. Statuses are informational only. See also [blocked-on-org.md](./blocked-on-org.md).

---

## 6. Still blocked on org / humans

- [ ] Org Android keystore + `SMILE_ANDROID_*`  
- [ ] Org Electron CSC_* + real `SMILE_UPDATE_FEED_URL`  
- [ ] Git remote + green Actions run  
- [ ] UAT migrations 001–045 applied (not prod)  
- [ ] Real HA-* sign-offs (HG-01 deferred; HG-05 current)  
- [ ] Live CO-* cutover + CERT-001 (after HA-*)

Full owner-action table: [blocked-on-org.md](./blocked-on-org.md).

---

*org-handoff-checklist.md — 2026-09-20 — technical handoff only; no fake Approvals; --run-tests default documented*
