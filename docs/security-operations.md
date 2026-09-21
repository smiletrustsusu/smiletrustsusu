# Module 22 — Security Operations, Fraud Detection & Risk Management

Security Operations is the **only** fraud, risk-scoring, and security-incident engine. It observes collections, payments, authentication, devices, and sync. It does **not** post collections, change interest **15%**, the 31-day cycle, cashier GHS **1,000**, or `customerBalance`.

Live collections stay on the collection form. Integrity/revocation gates from Module 19 remain the only collection blockers.

## What it does

- Scores risk 0–100 from large deposits, same-day duplicates, payment fraud flags, failed logins, revoked devices, sync conflicts, integrity failures, and rate-limit hits.
- Opens and closes security incidents.
- Tracks fraud investigations.
- Publishes `RiskScoreUpdated`, `FraudDetected`, `SecurityIncidentOpened`, and `SecurityIncidentClosed`.
- Raises Module 19 alerts when risk is high or critical.

## Interface contracts

Every module (1–22) exposes documented command, query, and event contracts such as `Savings.Collect.v1` and `Risk.Evaluate.v1`. Cross-module calls go through `invokeContract`. Direct SQL, private methods, and undocumented shortcuts are prohibited.

External callers still enter through Module 20. The gateway may consume **public** contracts only. Financial posting commands (`Savings.Collect.v1`, `Loan.Disburse.v1`, journal posts, and similar) are **owner-internal** and never create a second posting path.

Queries are side-effect free. Events may be published only by the owning module.

## Global API schema

Every contract uses the platform request/response envelope and two-axis header metadata (`src/core/api-schema.js`). See `docs/api-schema.md`. Trusted internal callers may omit the header; the gateway assigns `requestId`, `correlationId`, and `traceId`. External Android and API clients must satisfy conditional rules such as `deviceId` and `idempotencyKey`.

## UI

Extras sit under the existing **Audit Log**. Reports extras export CSV. No new nav item.

## Implementation

- Contracts: `src/core/module-contracts.js`, `src/core/module-contract-handlers.js`
- Engine: `src/core/security-ops.js`, `src/core/security-lifecycle.js`
- Extras: `src/ui/security-views.js`
- Schema: `supabase/migrations/033_security_contracts.sql`
