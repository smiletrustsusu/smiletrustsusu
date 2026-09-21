# WAVE-09 — UAT Pack Catalog

Companion to [wave9-pilot-uat.md](./wave9-pilot-uat.md). Machine SoT: `UAT_SCENARIOS` in `src/core/wave9-pilot-uat-ops.js`.

**Human execution:** [docs/uat/wave9-uat-execution-guide.md](./uat/wave9-uat-execution-guide.md) · run sheet [docs/release-evidence/wave9-uat-run-sheet.json](./release-evidence/wave9-uat-run-sheet.json) · in-app **UAT execution recorder** under Audit/Reports.

## How to record a result

For each scenario, fill:

| Field | Values |
|---|---|
| actual | What happened |
| passFail | `pass` \| `fail` \| `blocked` |
| evidence | Path, screenshot id, export hash, ticket |
| executedBy / executedAt | Operator identity + ISO time |
| approver / approverStatus | Role + `PendingHumanSignOff` \| `Approved` \| `Rejected` |
| notes | Optional |

Technical smoke proven by Wave 8 may show `TechnicalPassPendingBusinessSignOff` until a business approver sets `Approved`.

## Scenario matrix

| ID | Domain | Title | Mandatory | Tech smoke |
|---|---|---|---|---|
| UAT-AUTH-01 | auth | Login, session timeout, role-denied action | Y | Y |
| UAT-AUTH-02 | auth | Multi-role switch and audit of privileged actions | Y | |
| UAT-CUST-01 | customer | Register customer and verify KYC fields | Y | |
| UAT-CUST-02 | customer | Search / update without corrupting balances | Y | |
| UAT-SAVE-01 | savings | Open savings product and post contribution | Y | |
| UAT-COLL-01 | collections | Collector day cycle (31-day awareness) | Y | |
| UAT-COLL-02 | collections | Cashier float limit 1000 GHS enforced | Y | |
| UAT-TXN-01 | deposits_withdrawals | Deposit and withdrawal with receipt | Y | |
| UAT-TXN-02 | deposits_withdrawals | Insufficient funds blocked | Y | |
| UAT-LOAN-01 | loans | AI advisory does not auto-approve | Y | |
| UAT-LOAN-02 | loans | Disbursement and repayment schedule | Y | |
| UAT-EOD-01 | eod | EOD close and till reconciliation procedure | Y | |
| UAT-RECON-01 | eod | Financial reconciliation procedure (no false prod claim) | Y | |
| UAT-RPT-01 | reports | Operational reports export | Y | Y |
| UAT-DASH-01 | dashboards | Wave 7 analytics KPI dashboard | Y | Y |
| UAT-AUD-01 | audit | Audit trail for money-moving action | Y | |
| UAT-NOTIF-01 | notifications | Pilot alert channel smoke | Y | |
| UAT-OFF-01 | offline | Offline capture (Capacitor path) | Y | Y |
| UAT-SYNC-01 | sync | Sync conflict / retry / recovery | Y | Y |
| UAT-ADM-01 | admin | Admin search + ops monitoring | Y | Y |
| UAT-ADM-02 | admin | Wave 8 RC panel visible | Y | Y |

## Preconditions shared across money scenarios

- Pilot tenant isolation confirmed (`PE-*`)
- Money: pesewas · interest 15 · collection days 31 · cashier 1000
- `SUPER_ADMIN_FORBIDDEN` includes `System.Reset`
- AI remains advisory-only

## Phase 16 UAT thresholds (reference)

| Threshold | Meaning |
|---|---|
| THR-030 | Approved business scenarios % |
| THR-031 | Business sign-off present |
| THR-032 | Open High defects = 0 |
| THR-033 | Open Critical defects = 0 |

Wave 9 evidence tracks pack executability and human gates; THR-031 remains human for Wave 10 promote.
