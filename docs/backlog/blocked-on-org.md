# Blocked on org / humans — hard stop

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Date:** 2026-09-20  
**Verdict:** **Implementation paused pending org/humans** for go-live critical path. Safe in-repo gaps that do not need secrets, HA Approvals, production deploy, or SQL money rewrite are closed; remaining work cannot be invented by agents.

Related: [org-handoff-checklist.md](./org-handoff-checklist.md) · [human-gates-runbook.md](./human-gates-runbook.md) · [critical-path-report.md](./critical-path-report.md) · `npm run check:prod-readiness` · [../ci-remote-connect.md](../ci-remote-connect.md) · [../../scripts/apply-uat-migrations.md](../../scripts/apply-uat-migrations.md)

---

## What the agent did locally today (2026-09-20) vs still waiting on user/org

| Local (done / available without secrets) | Still waiting on user / org |
|------------------------------------------|-----------------------------|
| `npm test` green (747 pass / 0 fail) | Wave 9 HA-* flip to **Approved** by humans (never agent-fabricated) — who signs: HG-05 exec + domain owners per runbook |
| `npm run check:prod-readiness -- --run-tests` evidence refreshed → `docs/release-evidence/prod-readiness-check.json` | Install/enable **Git for Windows** on PATH (agent could not `git init` — `git` not found), then org VCS remote URL → `SMILE_GIT_REMOTE` + `npm run git:connect-remote -- --apply` |
| Debug APK present at `android/app/build/outputs/apk/debug/app-debug.apk` (not committed; `android/app/` gitignored) | Android release keystore path + `SMILE_ANDROID_*` passwords for signed release APK |
| `scripts/connect-git-remote.js` + `npm run git:connect-remote` (requires `SMILE_GIT_REMOTE`; no invented remotes) | Electron `CSC_*` / `WIN_CSC_LINK` + real `SMILE_UPDATE_FEED_URL` |
| UAT-only migrate helper: `scripts/apply-uat-migrations.js` + `.md` (requires `--i-understand-uat-only`; uses `SMILE_UAT_DATABASE_URL` only) | UAT DB URL / credentials so DBA can run `--apply` on UAT (never prod from agents) |
| Blocked-on-org Audit/Reports panel links org-handoff + HG-01…05 recorders | Live CO-01…CO-13 cutover + AA CERT-001 after real HA-* |
| `npm run prepare:web` keeps `www/` SoT in sync | MFA enroll/challenge proof in UAT + PV (GAP-015) |
| Windows spawn fix so readiness `--run-tests` actually executes `npm test` | CIO freeze lift before any money SQL rewrite (GAP-005 / GAP-019) |

**Agent stop rule unchanged:** no fake Approvals, no invented remotes/keystores, no production migrate, no commit unless the user explicitly asks.

---

## Hard stop (exact owner actions)

| ID | Gap / backlog | Owner | Exact action | Done when |
|----|---------------|-------|--------------|-----------|
| **HA-GATES** | GAP-003 · TASK-000181 | Executive Sponsor (HG-05) + domain owners (HG-02…04); HG-01 UAT deferred | Humans flip Wave 9 HA-* from `PendingHumanSignOff` → `Approved` with evidence. Login **JOHN** for exec recorder. **Never** agent-fabricated Approvals. | All required HA-* Approved in evidence JSON |
| **CUTOVER** | GAP-001 · TASK-000188 | Release Manager + CO-* owners | Execute live CO-01…CO-13 under Wave 10 runbook after HA-*. `npm run wave10:cutover-record` is **rehearsal timestamps only** (never Accepted). | CO-* completed with real timestamps + rollback readiness |
| **CERT-001** | GAP-002 · TASK-000191 | Accountable Authority + Executive Sponsor | Human AA sign-off after live cutover evidence; CERT-001 stays `certified: false` / preview until then. | `certified: true` with AA evidence |
| **PV / Hypercare** | GAP-009 · GAP-011 | Release Manager / Ops | Business PV-* remaining + start hypercare after cutover. | PV business acceptance + HC reviews |
| **ANDROID-SIGN** | GAP-004 · TASK-000185 | Platform Administrator | Org release keystore + `SMILE_ANDROID_*` env. Do **not** invent keystore files or passwords. | Signed release APK builds |
| **ELECTRON-SIGN** | GAP-008 · TASK-000186 | Platform Administrator | Org `CSC_*` / `WIN_CSC_LINK` + real `SMILE_UPDATE_FEED_URL` (not example.invalid). Then enable `signAndEditExecutable`. | Signed EXE + production update feed |
| **ARTIFACTS** | GAP-012 · TASK-000187 | Release Manager | After signing: produce release APK/EXE and `npm run hash:artifacts`. | Hashes in release-evidence |
| **CI-REMOTE** | GAP-007 · TASK-000192 | Platform Administrator | Connect org VCS remote; push so GitHub Actions CI runs green (`docs/ci-remote-connect.md`). Do **not** invent remotes. Helper: `SMILE_GIT_REMOTE` + `npm run git:connect-remote`. | Green Actions run on org remote |
| **UAT-MIG** | GAP-010 (apply) | DBA / Release Manager | Apply `rls.sql` + `001`…`045` on **UAT** Supabase only via `scripts/apply-uat-migrations.md` (not prod from agents). | UAT staff role smoke OK |
| **MONEY-SQL** | GAP-005 · BUG-000002 | CIO | Lift migration freeze only with approved plan — **no** float→pesewas SQL rewrite without CIO. JS guards remain. | Freeze lift + additive migration plan |
| **MOMO-SQL / live** | GAP-019 · BUG-000004 | CIO + Payments | After freeze lift: additive pesewas alignment; org MoMo credentials for live UAT (no invented secrets). | SQL + live provider evidence |
| **CSP** | GAP-014 · TASK-000196 | Security Governance Lead | Tighten Electron CSP when SPA bundling allows; document residuals. | CSP exceptions documented / tightened |
| **MFA proof** | GAP-015 · TASK-000182 | Security Governance Lead | Prove MFA enroll/challenge in UAT + PV (human security gate). | UAT/PV MFA evidence |

---

## Already closed in-repo (do not re-open as busywork)

| Gap | Status | Evidence |
|-----|--------|----------|
| GAP-006 PRODUCTION.md 001–045 | Completed | `PRODUCTION.md` |
| GAP-010 role CHECK migration file | Completed | `045_*.sql` (apply on UAT is org) |
| GAP-016 deploy profiles | Completed | `deploy/profiles/*` |
| GAP-018 www SoT guard | Completed | `check:www-sot` in CI / channels |
| GAP-020 MIB hygiene reconciliation | Completed | audit→MIB map |
| GAP-022 EIR aliases | Completed | `docs/backlog/eir-catalog-aliases.md` |
| GAP-023 PWA limits | Completed | `docs/backlog/pwa-web-offline-support.md` |
| GAP-024 bootstrap password fail-closed | Completed | `src/core/production-guards.js` |
| GAP-019 JS boundary (partial) | In Progress | inventory + webhook pesewas hooks; SQL still freeze |

Deferred by design (not org-blocked): GAP-013, GAP-017, GAP-021, GAP-025, GAP-026, GAP-027.

---

## Agent stop rule

When only HA-*, signing secrets, remotes, production deploy/migrations, or SQL money rewrite remain: **stop inventing busywork**. Point owners at this file + [org-handoff-checklist.md](./org-handoff-checklist.md).

UI: Audit / Reports → Wave 10 section → **Blocked on org / humans (read-only)** (links org-handoff + HG-01…05 recorders).

---

*blocked-on-org.md v1.1.0 — 2026-09-20*
