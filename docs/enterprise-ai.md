# Module 29 — Enterprise AI, Machine Learning & Predictive Intelligence Platform

Advisory / heuristic intelligence for SMILE TRUST SUSU MANAGEMENT SYSTEM. **AI never replaces Module 24 Rule Engine.** The Rule Engine remains the deterministic authority for financial and policy decisions. AI outputs are probabilistic, explainable, and require human oversight / Workflow authorization before any financial effect.

## Architecture

In-process engines only (vanilla JS SPA). No REST/GraphQL HTTP servers. External-style API surfaces map to Module 20 gateway routes + `invokeContract`. Money stays in integer **pesewas**; AI does not post collections, change loan interest (15), collection days (31), or Cashier limits.

### Implementation files

| File | Role |
|------|------|
| `src/core/ai-permission-registry.js` | **Canonical Permission Registry (Source of Truth)** |
| `src/core/ai-lifecycle.js` | Catalogs, error codes, model transitions, boundary |
| `src/core/ai-governance.js` | Datasets, SoD, roles/matrices **derived from registry** |
| `src/core/ai-ops.js` | Prediction, fraud, risk, recommend, forecast, anomaly, MLOps |
| `src/core/ai-api.js` | Contracts + gateway handlers |
| `src/ui/ai-views.js` | Audit Log / Reports extras (no new nav) |
| `supabase/migrations/042_enterprise_ai.sql` | Additive tables |
| `tests/ai-ops.test.js` | Acceptance tests |

## Core capabilities

1. **Prediction Engine** — growth, savings, loan demand/default, cash flow, revenue, productivity, payment success (heuristic + confidence + feature importance).
2. **Fraud Detection** — duplicate txns, suspicious withdrawals, auth/export/API anomalies → fraud alerts (no ledger mutation) + monitoring/workflow hooks.
3. **Risk Scoring** — Customer/Loan/Collector/Branch/Payment scores (versioned config).
4. **Recommendations** — advisory only; accept/reject/override with justification; **cannot** post money or auto-approve loans.
5. **Forecasting** — daily/weekly/monthly collections, repayments, liquidity, growth, workload, storage/API estimates (pesewas).
6. **Anomaly Detection** — txn/customer/loan/auth/API/infra metrics.
7. **Model Registry** — register/version/approve/deploy/rollback/retire/lineage; only approved models deploy.
8. **Feature Registry** — versioned features with validation/lineage/quality.
9. **MLOps** — training job metadata, validation, drift, shadow/canary flags, rollback; workflow-ready approvals.
10. **XAI** — every prediction: id, model version, confidence, feature importance, factors, explanation, timestamp, correlation ID.
11. **Human oversight** — review decisions + feedback as learning **metadata only**.

## Configuration

- Feature flag: `enableEnterpriseAi` (default enabled).
- Coarse RBAC: `Ai.View`, `Ai.Model`, `Ai.Predict`, `Ai.Govern`, `Ai.Admin`.
- SystemOwner (`john`) / Super Admin (`KBA`) get full actions (respecting `SUPER_ADMIN_FORBIDDEN`).
- Branch Manager (`Admin`): `Ai.View`, `Ai.Predict`.
- Collectors: **no** AI deploy/configure/predict grants.

## Public contracts

Examples: `Ai.Predict.v1`, `Ai.Fraud.Detect.v1`, `Ai.Risk.Score.v1`, `Ai.Recommend.v1`, `Ai.Forecast.v1`, `Ai.Anomaly.Detect.v1`, `Ai.Model.*`, `Ai.Feature.*`, `Ai.Dataset.*`, `Ai.Governance.*`, dashboard/statistics. Errors `AI-xxx`. Events: `PredictionGenerated`, `FraudAlertCreated`, `ModelDeployed`, `DriftDetected`.

## UI

Under existing **Audit Log** and **Reports** only: AI Ops Dashboard, Model Registry, Prediction Explorer, Feature Registry, Fraud Dashboard, Forecast Dashboard, Recommendation Center, Drift Monitoring, Model Approval, AI Audit Viewer, AI Governance Dashboard.

## Database

`042_enterprise_ai.sql`: ai_models, model_versions, model_registry, feature_registry, feature_versions, dataset_registry, prediction_requests/results, fraud_alerts, anomaly_events, recommendation_history, model_training_jobs, model_deployments, drift_events, inference_logs, plus grants/feedback. Seeds via `ensureAiState`.

---

## Enterprise AI Data Governance

- **Dataset registry** — metadata including classification (`Public` / `Internal` / `Confidential` / `Restricted`), checksum, quality scores, approval status.
- **Feature governance** — versioned features with lineage and quality gates.
- **Privacy** — minimization (no MoMo PINs / bank passwords), masking; Restricted not shown in UI unless authorized (`Ai.Govern` / `Ai.Admin` / SystemOwner).
- **Lineage & retention** — recorded on datasets/features/models; retention days on datasets.
- **Input validation** — dataset must be **approved** + checksum valid + quality ≥ 0.5 before train/inference.
- **Audit** — Module `29` audit events for predict/fraud/deploy/approve.

## Governance Roles & Responsibilities

Roles: AI Platform Admin, Chief Data Steward, Data Steward, Data Engineer, ML Engineer, MLOps, AI Security, Compliance, Model Validator, Internal Auditor, Business Owner, Risk Manager.

Responsibility matrix and escalation path live in `ai-governance.js`. **SoD**: creator ≠ approver; developer ≠ validator; deployer ≠ sole approver; no self-assign Critical; auditor ≠ operator.

## Role Permission Matrix (high-level)

Maps AI governance roles to family-level access (✓ / R / A / —). Platform RBAC coarse actions (`Ai.*`) gate entry; detailed checks use the Canonical Registry.

## Permission Catalog

Full inventory of `AI.*` permissions with schema fields is **exactly** `AI_PERMISSION_REGISTRY` in `src/core/ai-permission-registry.js` (Dataset, Feature, Model, Prediction, Recommendation, Governance, Platform, Pipeline, Drift, Inference).

## Complete Role–Permission Matrix

Built by `buildCompleteRolePermissionMatrix()` — every governance role × every registry permission (✓/R/A/—). **No wildcards / implied grants.**

## Permission Scope Matrix & Remaining Scope Definitions

From registry helpers `permissionScopeMatrix()`: each permission lists `allowedScopes`, `defaultScope`, `maxScope`. Platform-only permissions cannot be granted at Org/Branch/Self beyond allowed lists (`assertAiScopeValid`).

## Permission Assignment Scope Matrix

From `permissionAssignmentScopeMatrix()`: assignment, delegation, approval, and revocation scopes per permission; `delegable` flag; Critical assigners restricted.

## CANONICAL SINGLE PERMISSION REGISTRY (authoritative)

**Source of Truth:** `src/core/ai-permission-registry.js`

Every AI permission appears **exactly once** with:

- Permission Code  
- Authorization Scope (allowed / default / max)  
- Assignment Scope, Delegation Scope, Approval Scope, Revocation Scope  
- Risk Level, MFA Required, Workflow Approval Required, Delegable  
- **Auditable = true** always  

Helpers: `listAiPermissions`, `getAiPermission`, `assertAiScopeValid`, `canAssignAiPermission`, `evaluateAiPermission`, SoD via `assertAiSegregationOfDuties`.

Catalog, role matrix, and scope matrices **MUST derive from / reference** this single registry to avoid contradictions.

## Acceptance

- Predictions explainable + versioned  
- Recommendations cannot post money / auto-approve loans  
- Fraud alerts do not mutate ledger  
- Model deploy requires approval; SoD blocks developer self-approve  
- Dataset approved + checksum before train/inference  
- Registry completeness + scope/assignment/delegation rules  
- Collector RBAC denials  
- Gateway/contracts work; security-ops includes module 29  
- `npm test` + `npm run prepare:web` green  

## Version history

| Version | Notes |
|---------|--------|
| 1.0.0 | Module 29 initial release |
