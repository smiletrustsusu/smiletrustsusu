# WAVE-05 — Enterprise Web Administration Portal (SPA Hardening)

**Status:** Delivered as shared vanilla JS SPA portal hardening  
**Date:** 2026-09-15  
**Wave:** WAVE-05 · MIB CUSTOMER / SAVINGS / DAILY_COLLECTIONS · Modules 3, 4, 6, 7, 9, 16, 17, 26 · Phases 3, 4, 16

---

## 1. Architecture decision (do not violate)

| Channel | Runtime |
|---|---|
| Web administration portal | Shared SPA (`app.js` + `src/` + responsive CSS) |
| Desktop EXE | Electron loads `www/` (Wave 6: `docs/wave6-windows-exe.md`) |
| Android APK | Capacitor loads the same `www/` |

Wave 3 APIs are **in-process `invokeApi` contracts**, not a live HTTP backend for a Next.js BFF.

### Why Wave 5 is **not** a Next.js / TypeScript / Tailwind / shadcn rewrite

- Would **duplicate** Modules 1–30 UI already in the SPA
- Would **split** Web vs EXE vs APK into divergent frontends
- Would violate project invariants (**no** Next.js / Flutter rewrite; shared-core model)
- Would **bypass** Wave 3 `invokeApi` and re-implement posting / RBAC incorrectly
- Money posting (integer **pesewas**), interest **15**, collection days **31**, cashier GHS **1000**, and `SUPER_ADMIN_FORBIDDEN` already live in the shared JS core

**Wave 5 value** = enterprise admin portal **completeness and hardening** on the existing SPA: RBAC gaps, ops monitoring, API-wired reads, search/filters, a11y, and lazy panels — pilot-ready as the same web portal.

---

## 2. Gap analysis (checklist)

| ID | Item | Status |
|---|---|---|
| W5-G01 | Admin surfaces (users/roles/branches/config/flags) | Closed |
| W5-G02 | Customer / savings / collections / loans / accounting / reports UI | Closed |
| W5-G03 | RBAC + tenant/branch isolation on portal API paths | Closed |
| W5-G04 | Ops monitoring under Audit/Reports (no new top-level nav) | Closed |
| W5-G05 | Wire admin/read workflows to Wave 3 `invokeApi` | Closed |
| W5-G06 | Collections reconciliation + pending sync visibility | Closed |
| W5-G07 | Dashboard/report accuracy via API-backed KPIs (pesewas) | Closed |
| W5-G08 | Global search / advanced filter helpers | Closed |
| W5-G09 | Accessibility on touched portal panels | Closed |
| W5-G10 | Lazy panels for heavy dashboard/ops tables | Closed |
| W5-G11 | No Next.js / React / Tailwind portal rewrite | Closed |
| W5-G12 | Every legacy Class-A collection write forced through `invokeApi` | **Partial** — portal helpers available; collector wizard remains Class-A local path |

Authoritative runtime checklist: `analyzeWave5Gaps()` / `WAVE5_GAP_CHECKLIST` in `src/core/wave5-admin-portal-ops.js`.

---

## 3. Module → SPA screen map

| Area | SPA view / surface | Primary `invokeApi` ops |
|---|---|---|
| Users / Roles / Permissions | Settings / users | `v1/auth.roles`, `v1/authorization.*` |
| Tenant / Region / Branch | Branches + Platform Admin (Audit) | `v1/authorization.checkTenantBranch`, `v1/authorization.scope` |
| Devices | Backup / Sync | `v1/auth.registerDevice`, `v1/sync.status` |
| Feature flags / System config | Settings | `v1/configuration.get`, `.flags`, `.moneyDefaults` |
| Customers | Customers | `v1/customers.*` |
| Savings | Collections / savings products | `v1/savings.*` |
| Daily collections | Collections | `v1/collections.*` |
| Loans | Loans | `v1/loans.*` |
| Accounting | Accounting | `v1/accounting.*` |
| Reports / Dashboards | Reports / Home | `v1/reporting.*`, `v1/dashboards.*` |
| Ops monitoring | **Audit + Reports + Backup** (no new nav) | `v1/monitoring.*`, `v1/sync.*`, `v1/audit.search` |

Full map constant: `WAVE5_MODULE_SCREEN_MAP`.

---

## 4. What was wired to `invokeApi`

| Portal capability | Operations |
|---|---|
| Global customer search | `v1/customers.search` (+ scoped local loans/collections/groups) |
| API KPI strip (Reports) | `v1/dashboards.summary`, `v1/dashboards.kpis`, `v1/collections.daily`, `v1/configuration.moneyDefaults`, `v1/monitoring.health`, `v1/sync.status` |
| Portal gateway helper | `portalInvoke(state, request, { user, uid, now })` |
| RBAC gates for UI actions | `assertPortalAction` + existing middleware authz |

**Not duplicated:** posting math stays in `collection-ops`, double-entry, loans-workflow, accounting-ops. Wave 5 orchestrates reads/admin surfaces only.

---

## 5. UI surfaces (no new top-level nav)

- **Audit:** Operations monitoring, Wave 5 checklist, module→screen map, global search
- **Reports:** Operations monitoring + Portal API KPI strip (pesewas-preserving labels)
- **Backup:** Existing Wave 4 offline sync platform panel (unchanged contract)
- Shared primitives: `stLazyPanel`, `stSearchField`, `stFilterBar`, `stSrOnly`, `stMoneyStat` in `src/ui/shared-primitives.js`
- CSS: `.sr-only`, `.wave5-lazy-panel` focus styles in `styles.css`

---

## 6. Admin guide (operators)

1. Sign in with a role that has `Audit.View` / `Reports.View` / `Monitor.View` / `Sync.View` (or System Owner `john`).
2. Open **Audit** → scroll to **Operations monitoring** for collector online/offline, sync pending (incl. collection queue), device/health scores, and recent audit.
3. Use **Portal global search** for customer lookup via API; optional branch/status filters apply tenant/branch isolation helpers.
4. Open **Reports** → **Refresh API KPIs** to load daily collections totals and money defaults (15 / 31 / 1000) through `invokeApi`.
5. Expand lazy panels only when needed — heavy collector/audit tables stay collapsed by default.
6. Super Admin cannot run `Owner.Transfer`, `System.Reset`, or `Export.All` (`SUPER_ADMIN_FORBIDDEN`).

---

## 7. Accessibility notes (WCAG-oriented)

- Ops / search controls expose `aria-label` / `role="search"` / `role="status"` / `role="alert"`
- Form fields keep visible `<label for=…>`
- Lazy panels use native `<details>`/`<summary>` (keyboard operable) with focus-visible outline
- `.sr-only` for screen-reader-only context text
- Status is never color-alone (text labels for online/offline, sync stage, health)
- Contrast: reuse existing Smile Trust teal/neutral panel styles; focus ring `#0d7a63`

---

## 8. Performance notes (Phase 17 aligned)

- Dashboard/report KPI reads use Wave 3 gateway cache TTL (10s) on `dashboards.*` / `reporting.dashboard`
- Lazy panels avoid expanding heavy tables on every full `render()`
- Panel open state stored in `sessionStorage` (`wave5_lazy_panels`) so re-renders do not force-open everything
- Do not introduce React re-render trees — keep pure HTML string panels

---

## 9. Build / deploy (existing pipelines)

```powershell
npm test
npm run prepare:web
```

- `prepare:web` copies `app.js`, `styles.css`, and `src/` into `www/` for Electron EXE and Capacitor APK
- No separate Next.js build
- Pilot = existing web portal at `index.html` / `www/index.html`

---

## 10. Key files

| Path | Role |
|---|---|
| `src/core/wave5-admin-portal-ops.js` | Facade, gap analysis, ops model, search, KPIs, RBAC helpers |
| `src/ui/admin-portal-views.js` | Ops / search / checklist / KPI HTML |
| `src/ui/shared-primitives.js` | Shared a11y / lazy / search primitives |
| `app.js` | Wires panels under Audit + Reports; handlers |
| `styles.css` | `.sr-only`, lazy panel focus |
| `tests/wave5-web-admin-portal.test.js` | Portal + API wiring tests |
| `docs/wave5-web-admin-portal.md` | This guide |

---

## 11. Self-validation checklist

- [x] Admin workflows remain on existing SPA + Wave 3 APIs
- [x] RBAC / tenant-branch gates on new portal paths
- [x] Dashboards/reports preserve pesewas formatting
- [x] No React / Next.js introduced
- [x] Ops monitoring under Audit/Reports only
- [x] `npm test` / `npm run prepare:web` (run in CI or local agent)
- [ ] Commit — **do not commit** unless explicitly requested

---

## 12. Partial / follow-ups

- Legacy Class-A collection wizard posting path remains local (audit + double-entry + offline queue); prefer `v1/collections.record` / `portalInvoke` for new API-first callers
- Deep loan lifecycle hardening remains WAVE-06; GL rewrite remains WAVE-07
- Production certification remains WAVE-10 (EIR `waveStatus` stays **Mostly Complete**)
