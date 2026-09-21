# Module 24 — Enterprise Rule Engine & Decision Management

The Rule Engine is the **centralized business rule evaluation and decision management** service for the SMILE TRUST SUSU MANAGEMENT SYSTEM. Business modules own their processes. This engine owns only configurable evaluation of rules, tables, trees, expressions, and scoring models.

It does **not** post collections, change loan interest **15%**, the 31-day cycle, cashier GHS **1,000**, or `customerBalance`. Live withdrawals, loans, and collections stay on their owning screens and engines.

No other module shall implement its own configurable business rules, decision trees, approval conditions, validation expressions, scoring formulas, or eligibility logic outside this engine.

## What it does

- Evaluates validation, decision, calculation, eligibility, risk, routing, policy, and scoring rules.
- Executes decision tables (first / unique / collect / any / priority hit policies) and decision trees.
- Evaluates sandboxed boolean, arithmetic, date, string, and collection expressions. `eval` and `Function` are disabled.
- Runs scoring models with weights, normalization, and thresholds.
- Versions rules (`draft → testing → approval → published → deprecated → retired`). Running evaluations pin the version they started with unless an approved migration exists.
- Requires passing tests before publication. Maker-checker approval applies except for System Owner.
- Signs published versions. Simulation and historical replay never write production execution history or mutate financial data.
- Supports synchronous, batch, scheduled (`rule_batch_evaluate`), and event-triggered evaluation. All evaluations are deterministic and side-effect free.

Calculation rules may **compute** suggested interest, fees, or targets. They never apply those values to ledgers.

## Implementation

- Lifecycle: `src/core/rule-lifecycle.js`
- Expression sandbox: `src/core/rule-expression.js`
- Engine: `src/core/rule-ops.js`
- Public contracts: `src/core/rule-api.js`
- SLOs and workload profiles: `src/core/rule-slo.js`
- Extras: `src/ui/rule-views.js` under the existing **Audit Log**
- Schema: `supabase/migrations/037_rule_engine.sql`
- Tests: `tests/rule-ops.test.js`

There is no REST or GraphQL HTTP server. Gateway routes such as `POST /rules/evaluate` are in-process Module 20 contracts.

## Public contracts

Commands: `Rule.Evaluate.v1`, `Rule.EvaluateSet.v1`, `Rule.Simulate.v1`, `Rule.Test.v1`, `Rule.Publish.v1`, `Rule.Retire.v1`, `Rule.Approve.v1`, `Rule.Reject.v1`, `Rule.SubmitTest.v1`, `Rule.SubmitApproval.v1`, `Rule.Import.v1`, `Rule.Export.v1`, `Rule.Replay.v1`.

Queries: `Rule.Get.v1`, `Rule.List.v1`, `Rule.History.v1`, `DecisionTable.Get.v1`, `DecisionTree.Get.v1`, `ScoringModel.Get.v1`, `Rule.Statistics.v1`.

Events: `RuleEvaluated`, `RulePublished`, `RuleRetired`, `RuleApproved`, `RuleFailed`, `RuleSimulated`.

Error codes: `RE-001` … `RE-012` (not found, unsupported version, invalid state, expression error, unauthorized, tests failed, duplicate, invalid transition, already published, concurrency, timeout, sandbox).

Any module may invoke public Rule contracts. Modules must not write `rule_*` tables directly.

## Seeded rules

Published examples (hints only; they do not replace owning-module engines):

- `min_savings_amount`, `max_withdrawal_amount`, `loan_eligibility`
- `withdrawal_decision` (decision table)
- `payment_risk_score` (scoring model)
- `collection_target` (uses cycle days **31** as an input, does not change Settings)
- `workflow_routing` (decision tree)
- `cashier_limit_hint` (documents the GHS **1,000** cashier policy; RBAC still enforces the live limit)

## Concrete implementation deliverables

Delivered as production in-process components (not placeholders):

- Core engines: evaluation, decision table/tree, expression, scoring, dependency/version/lifecycle/cache managers
- Services: rule, decision, simulation, testing, approval, history, import, export
- Infrastructure: local persistence arrays + additive SQL, optimistic locks, event publisher, scheduler job, monitoring metrics, immutable audit
- APIs: documented contracts and gateway routes with request/response fields, authorization, and error codes
- Database: normalized tables, checks, indexes, published catalog view, additive migration, documented rollback
- UI: catalog, evaluate/simulate/test/publish actions, history, and report exports under existing Audit/Reports screens (responsive, dark-mode compatible)
- Configuration: `rule.executionTimeoutMs`, cache TTL, simulation limit, version retention, maker-checker, `enableRuleEngine`
- Security: RBAC (`Rule.View/Design/Test/Simulate/Approve/Publish/Admin`), maker-checker, publication signatures, sandbox isolation
- Observability: evaluation count, latency, cache hit rate, Module 19 metrics
- Tests, documentation, and `prepare:web` deployment copy

Quality gate for this repository: `npm test` must pass. W3 production soak/hardware certification is documented and monitored; W1 developer timings are not acceptance evidence.

## Performance targets & SLOs

Unless stated otherwise, latency targets are **server-side**, Profile **W3**, **warm cache**, concurrency **C4**.

| Operation | P95 | P99 |
|-----------|-----:|----:|
| Rule evaluation | 50 ms | 100 ms |
| Decision table | 75 ms | 150 ms |
| Decision tree | 100 ms | 200 ms |
| Expression | 30 ms | 75 ms |
| Metadata query | 100 ms | 250 ms |
| Publication | 2 s | 5 s |
| Single-rule simulation | 500 ms | 2 s |

Throughput (per node, W3): ≥ 2,000 evaluations/s, ≥ 3,000 table lookups/s, ≥ 1,000 concurrent workflow rule requests, ≥ 100 concurrent simulations. Cache hit rate ≥ 95%. Availability ≥ 99.95%. Failover detection/redistribution ≤ 30 s. Startup/readiness ≤ 60 s.

A release fails performance certification if it exceeds a documented latency target by more than 10%, reduces throughput by more than 10% without an approved exception, or sustains resource use above 70% CPU / 75% memory under equivalent W3 load.

## Performance workload profiles & measurement conditions

Every published target must name profile, dataset, concurrency, request mix, cache state, topology, percentiles, and observation window.

| Profile | Purpose | Acceptance |
|---------|---------|------------|
| W1 Development | Local validation, ≤ 10k records, ≤ 20 users | **No** |
| W2 Functional test | Integration, ≤ 100k records, ≤ 100 users | No |
| W3 Production nominal | Warm cache, 1–5M business records, ≤ 1,000 users, jobs/audit/monitoring on | **Yes** — default |
| W4 Peak | 2× rate, ≤ 2,500 users | Graceful degradation |
| W5 Stress | Beyond capacity | Informational |

Dataset assumptions (W3): 1M customers, 20M savings txns, 2M loans, 50M GL entries, 5M workflows, 100M audit rows, 25M rule history rows.

Cache: Rule Engine latency uses **Warm Cache** unless stated. Concurrency tiers C1–C6. Observation windows: 15 min latency, 60 min sustained, 24 h soak. Benchmark reports must include profile, infrastructure, dataset, cache, concurrency, mix, window, P50/P95/P99, resource use, software version, and timestamp.

Machine-readable catalog: `RULE_SLOS` and `WORKLOAD_PROFILES` in `src/core/rule-slo.js`.

## Acceptance

The module is complete when configurable rules are centralized; modules invoke published interfaces only; tables, trees, scores, and expressions are versioned and testable; execution is deterministic, auditable, and side-effect free; publishing requires tests and approval; Workflow/Security/Monitoring/Audit/Reporting integrate; simulations never mutate production data; and automated tests cover evaluation, versioning, scoring, tables, trees, sandboxing, simulation, concurrency locks, authorization, contracts, SLOs, and backward compatibility.
