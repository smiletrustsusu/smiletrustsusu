# Gap Register (Machine-Oriented)

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Audit date:** 2026-09-17  
**Source:** Read-only audit vs Modules 1–30 · Phases 1–20 · EDSM · MIB · EIR · Waves 1–10  
**Note:** Gaps are for **future** backlog updates — MIB was **not** modified in this audit.

Severity: Critical | High | Medium | Low | Enhancement  
Effort: XS | S | M | L | XL (or hours)  
Order: implementation priority (1 = soonest)

---

## Gap table

| Gap ID | Severity | Description | Module | Phase | Existing | Required | Effort | Dependencies | Order |
|--------|----------|-------------|--------|-------|----------|----------|--------|--------------|------:|
| GAP-001 | Critical | Live production cutover not executed; CO-* steps remain ReadyToExecute with null timestamps (0/13 completed) | 30 / Platform | 20 / Wave 10 | Wave 10 runbook + synthetic `validate:golive` evidence (`docs/release-evidence/wave10-golive-evidence.json`) | Execute CO-01…CO-13 with owners, timestamps, rollback readiness; record live cutover | L (ops) | GAP-002, GAP-003, GAP-006 | 7 |
| GAP-002 | Critical | CERT-001 remains preview (`certified: false`); Accountable Authority + Executive Sponsor PendingHumanSignOff | 22 / Security · Governance | 16 / 20 · Wave 10 | CERT-001 preview linkage in Wave 10 evidence | Human AA approvals + live cutover evidence → certified | S (gov) | GAP-001, GAP-003 | 9 |
| GAP-003 | Critical | Wave 9 Conditional gates open: business UAT, training, financial recon, executive sponsor, security acceptance all PendingHumanSignOff | 11–13 · Ops | 18 · Wave 9 | Pilot/UAT packs; UAT 21/21 executable but 0/21 business signed | Flip HA-* PendingHumanSignOff → Approved with evidence | M (human) | RC1 PASS (done) | 1 |
| GAP-004 | High | Android Capacitor Gradle project (`android/app`) not in repo; only README + plugins-src scaffold | 15 · Offline | Wave 4 | `capacitor.config.json`, build scripts, plugin stubs, Wave 4 JS sync | Reproducible APK path: generate/commit Gradle tree or CI artifact + release signing verify | M | prepare:web | 5 |
| GAP-005 | High | Dual money model: core tables use `numeric(14,2)` GHS with generated pesewas; later migrations still use `numeric` amounts — conflicts with integer-pesewas SoT | 6–10 · 16 | Wave 2 · Phase $ | `money.js` integers; `002` generated columns; Wave 044 cashier pesewas guard | Additive migration plan: integer pesewas write path authoritative; stop float authoritative writes; recon tests | L | Migration freeze | 4 |
| GAP-006 | High | `PRODUCTION.md` / early ops docs list migrations only through 007; repo has 001–044 | 14 · Ops | Wave 2 / 10 | Migrations 008–044 + Wave 2 docs | Update production cutover docs to ordered 001–044 (+ rls.sql) without removing working steps | S | — | 3 |
| GAP-007 | High | No CI pipeline (no `.github`, Azure, GitLab, Jenkins) and no `.git` in workspace snapshot — tests/validators not gated | 30 · DevOps | 14 · 19 | `npm test`, `validate:rc/pilot/golive` scripts locally | Establish VCS remote + CI running test + wave validators on PR | M | Org process | 10 |
| GAP-008 | High | Electron code signing disabled (`signAndEditExecutable: false`); updater publish URL is `updates.example.invalid` | Desktop Wave 6 | Wave 6 / 10 | Hardened Electron main/preload/IPC | Real signing certs + production update channel | M | Cert procurement | 6 |
| GAP-009 | High | Production validation PV-* business acceptance 0/18; only PV-001…006 technical smoke; metrics actuals null | Cross-module | Wave 10 | PV pack defined in golive evidence | Execute remaining PV checks + human approvers; fill SM-* actuals | L (ops) | GAP-001, GAP-003 | 8 |
| GAP-010 | High | SQL `app_users.role` CHECK still early roles (Owner/AssistantManager/Collector/Auditor) vs full JS agency RBAC | 1 · 4 · 14 | Wave 2 | `src/core/roles.js` + `rbac.js` full matrix | Additive migration expanding role CHECK / mapping table aligned to JS roles | M | GAP-005 planning | 4 |
| GAP-011 | High | Hypercare HC-001 status NotStarted; no daily reviews; success metrics not measured in-repo | 19 · Ops | 18 · Wave 10 | Hypercare plan 14d + 30d watch in evidence | Start hypercare after cutover; track P1–P4; exit criteria | M | GAP-001 | 8 |
| GAP-012 | High | Packaged release binaries largely absent (`dist/` only builder-debug); no verified prod APK/EXE artifacts in tree | 30 | Wave 6 / 8 / 10 | Build scripts present | Produce signed release artifacts + store evidence hashes in release-evidence | M | GAP-004, GAP-008 | 6 |
| GAP-013 | Medium | Not all domain surfaces routed exclusively via `invokeApi`; some SPA→ops paths may bypass API middleware | 20 | Wave 3 · 5 | Gateway + many `v1/*` ops in `register-controllers.js` | Extend controllers/services for remaining posting paths; keep engines shared | L | Wave 3 platform | 11 |
| GAP-014 | Medium | Electron CSP allows `'unsafe-inline'` and `'unsafe-eval'` | 22 | Wave 6 · Phase 9 | CSP header present otherwise | Tighten CSP where SPA allows; document residual exceptions | M | SPA bundling | 12 |
| GAP-015 | Medium | MFA schema present (`user_mfa_secrets`) but production UX/enforcement completeness unclear vs catalog | 1 · 22 | Phase 9 | Migration 005 MFA tables | Prove MFA enroll/challenge path in UAT + PV | M | GAP-003 security | 2 |
| GAP-016 | Medium | `deploy/` is README stub only; no environment manifests for prod ≠ pilot | 30 | Wave 9 / 10 | PRD-ENV checklist in evidence (framework) | Populate deploy manifests / config profiles for prod | S | GAP-006 | 3 |
| GAP-017 | Medium | Deep loan state-machine / CoA-GL rewrite deferred; Modules 8 & 10 remain Mostly Complete by design | 8 · 10 | Wave 6–7 aliases | Loans/accounting workflows + tests exist | Ticket remaining FEAT/TASK in MIB; do not confuse with Wave restart | XL | Product priority | 15 |
| GAP-018 | Medium | `www/` mirrors full `src/` (~160 core files) — edit-SoT confusion risk | Cross | EDSM · Wave 1 | `prepare:web` script | CI guard: forbid hand-edits to `www/`; regenerate only | S | GAP-007 | 10 |
| GAP-019 | Medium | MoMo webhook `amount numeric(14,2)` and early collections float columns vs pesewas invariant | 16 | Wave 2 | Payment ops + momo tests | Align webhook amounts to pesewas integers | M | GAP-005 | 4 |
| GAP-020 | Medium | Open MIB items ~272 (Planned/Not Started/In Progress/Deferred) vs 426 released-like — backlog hygiene lag | Cross | MIB | `backlogStatusSummary()` 698 total | Refresh statuses from this register; close obsolete Planned items | M | This audit | 2 |
| GAP-021 | Low | `package.json` lacks `"type":"module"` causing Node MODULE_TYPELESS warnings | 30 | EDSM | ESM syntax in src | Add type module carefully or .mjs strategy without breaking Electron | XS | Smoke EXE/Web | 13 |
| GAP-022 | Low | Historical EIR catalog names (Loan Platform, Accounting Platform, Production Readiness) vs delivery names confuse agents | Roadmap | EIR | Alias notes in wave docs/registries | Keep aliases; avoid renaming engines | S (docs) | — | 14 |
| GAP-023 | Low | PWA service worker / offline web parity less evidenced than Capacitor offline engine | 15 | Wave 4 / 5 | `service-worker.js`, manifest | Define support level or document web-offline limits | S | Product | 14 |
| GAP-024 | Low | Default owner/dev passwords documented for bootstrap — residual if productionMode not enforced | 1 | Wave 10 | PRODUCTION.md Phase B; config flags | Automated prod guard fail-closed | S | GAP-001 | 7 |
| GAP-025 | Enhancement | Optional thin Kotlin bridges (biometrics, WorkManager) beyond stubs | 15 | Wave 4 | Plugin stubs in plugins-src | Implement only as adapters around SPA | M | GAP-004 | 16 |
| GAP-026 | Enhancement | Broader OpenAPI coverage export for all Module ops | 20 | Wave 3 | `docs/openapi/wave3-api.openapi.json` | Generate from route-registry | S | — | 16 |
| GAP-027 | Enhancement | Post-go-live continuous improvement backlog automation linked to Phase 19 CRs | 30 | 19 · Wave 10 | CI-PROC-001 described in evidence | Wire service-desk → MIB identifiers | M | GAP-001 | 17 |

---

## Status legend for “Existing”

Describes what already exists in-repo (framework/catalog/runtime). Gaps above distinguish **catalog complete** vs **production cutover complete**.

## Counts

| Severity | Count |
|----------|------:|
| Critical | 3 |
| High | 9 |
| Medium | 8 |
| Low | 4 |
| Enhancement | 3 |
| **Total** | **27** |

*Note:* GAP-004…GAP-012 = 9 High in this table (GAP-004 through GAP-012).

---

## Recommended MIB update (done 2026-09-17)

Mapped Critical/High/Medium/Low/Enhancement gaps to `TASK-` / `BUG-` / `CR-` / `FEAT-` identifiers in `src/core/master-backlog-registry.js`. See [`../backlog/gap-register-reconciled.md`](../backlog/gap-register-reconciled.md).

---

*gap-register.md v1.0.0 — 2026-09-17 · reconciliation pointer added*
