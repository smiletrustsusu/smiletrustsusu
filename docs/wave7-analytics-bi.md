# WAVE-07 — Enterprise Analytics, BI & AI Platform

**Status:** Delivered as shared-core analytics facade  
**Date:** 2026-09-16  
**Wave:** WAVE-07 · Modules 11 / 27 / 29 · Phase 11 reporting KPIs · Phase 12 AI governance  

---

## 1. Architecture decision (do NOT violate)

| Channel | Runtime |
|---|---|
| Web | Shared SPA (`app.js` + `src/`) |
| Desktop EXE | Electron loads `www/` after `prepare:web` |
| Android APK | Capacitor loads the same `www/` |

Wave 7 is **not** a Next.js / React BI rewrite. It is a **facade** over:

- Module 11 `report-ops.js` (catalog, schedule, CSV export)
- Module 27 `bi-ops.js` (canonical KPI formulas — **single SoT**)
- Module 29 `ai-ops.js` (advisory predictions / fraud / forecast)
- Module 24 `rule-ops.js` (optional deterministic rule eval)

### Catalog mapping (EIR name vs delivery)

| Field | Value |
|---|---|
| Delivery name | **Enterprise Analytics & BI Platform** (`ANALYTICS_BI`) |
| Historical EIR catalog name | Accounting Platform (`ACCOUNTING_PLATFORM`) |
| MIB wave 11 ACCOUNTING / Module 10 | Remains mapped; deep CoA/GL rewrite **deferred** |
| Wave 7 focus | KPIs, reports, BI helpers, fraud detect, AI advisory |

Money posting stays in existing ops. AI **never** auto-approves loans or posts money.

---

## 2. Gap analysis

| ID | Item | Status |
|---|---|---|
| W7-G01 | Reporting framework facade | Closed |
| W7-G02 | Operational reports via report-ops + invokeApi | Closed |
| W7-G03 | Executive role-filtered KPI dashboards | Closed |
| W7-G04 | KPI engine facade (Module 27 formulas only) | Closed |
| W7-G05 | BI drill-down / period compare / branch benchmark | Closed |
| W7-G06 | AI assistant layer with RBAC + audit | Closed |
| W7-G07 | Fraud/anomaly detectors (7 rules + Module 29) | Closed |
| W7-G08 | Predictive MA/linear forecasts (advisory) | Closed |
| W7-G09 | Ghana microfinance regulatory templates | Closed |
| W7-G10 | Export gates + masking + audit | Closed |
| W7-G11 | UI under Reports/Audit (no new nav) | Closed |
| W7-G12 | Docs + roadmap/MIB notes | Closed |
| W7-G13 | KPI fixture + authz/export/fraud/AI tests | Closed |
| W7-G14 | Accounting Platform deep GL rewrite | Deferred |
| W7-G15 | Opaque paid ML vendor | Partial — transparent MA/linear + Module 29 |

Runtime: `analyzeWave7Gaps()` / `WAVE7_GAP_CHECKLIST` in `src/core/wave7-analytics-bi-ops.js`.

---

## 3. Key files

| Path | Role |
|---|---|
| `src/core/wave7-analytics-bi-ops.js` | Facade: KPI, report, BI, AI, fraud, forecast, regulatory |
| `src/ui/wave7-analytics-views.js` | Reports/Audit panels (no new top-level nav) |
| `docs/wave7-analytics-bi.md` | This guide |
| `tests/wave7-analytics-bi.test.js` | KPI fixtures + authz/fraud/AI/export |

---

## 4. Canonical KPIs (Module 27 SoT)

| Code | Formula (via `calculateKpi`) |
|---|---|
| KPI-COL-RATE | pct(MET-SAV-001, MET-SAV-002) |
| KPI-LOAN-REC | pct(MET-LOAN-001, MET-LOAN-002) |
| KPI-SAV-GROWTH | pct(MET-SAV-003 − MET-SAV-004, MET-SAV-004) |
| KPI-CUS-GROWTH | pct(MET-CUS-001, MET-CUS-002) |
| KPI-ACTIVE-MEM | pct(MET-CUS-003, MET-CUS-004) |
| KPI-BRANCH-PROFIT | MET-ACC-001 − MET-ACC-002 |
| KPI-COL-PROD | MET-COL-001 / MET-COL-002 |
| KPI-WF-SLA | pct(MET-WF-001, MET-WF-002) |
| KPI-SYS-AVAIL | pct(MET-MON-001 − MET-MON-002, MET-MON-001) |
| KPI-PAY-SUCCESS | pct(MET-PAY-001, MET-PAY-002) |

Extended KPIs (`EXT-*`) wrap existing report/dashboard aggregates (pesewas annotations) — they do **not** invent new money math.

---

## 5. Fraud rules (detect-only)

Seven deterministic rules (`WAVE7_FRAUD_RULES`): duplicate txn, abnormal collections, suspicious withdrawals, unusual loan approvals, unauthorized access, sync anomaly, out-of-hours. Optional Module 29 `detectFraud` alerts append as advisory findings. **No ledger mutation.**

---

## 6. AI advisory

`routeAiInsight` audits request/response, requires `Ai.Predict` (or SystemOwner `john`), routes to fraud / forecast / recommend / predict. Flags: `advisory: true`, `postsMoney: false`, `autoApprovesLoan: false`.

---

## 7. UI (no new top-level nav)

- **Audit:** Wave 7 analytics panel + parity checklist
- **Reports:** Same panel + report catalog buttons + Ghana regulatory templates
- Actions: Refresh KPIs, AI insights, Fraud scan, 30d forecast, Export JSON

---

## 8. Admin / operator guide

1. Sign in as a role with `Reports.View` / `Bi.View` / `Ai.View` (or System Owner).
2. Open **Reports** or **Audit** → **Enterprise Analytics & BI (Wave 7)**.
3. **Refresh KPIs** — calculates via Module 27.
4. **Fraud scan** / **AI insights** — detect-only / advisory; review findings.
5. Export uses masking for phone/Ghana Card/PIN fields.

Money defaults remain interest **15**, collection days **31**, cashier GHS **1000**, integer **pesewas**. `SUPER_ADMIN_FORBIDDEN` unchanged.

---

## 9. Partial / deferred

| Item | Notes |
|---|---|
| Opaque ML vendors | Not integrated; MA/linear + Module 29 heuristics |
| Accounting CoA deep rewrite | Historical WAVE-07 name; deferred |
| Live scheduler distribution | Uses Module 11 `scheduleReport` stubs |

---

## 10. Verification

```powershell
npm test
npm run prepare:web
```
