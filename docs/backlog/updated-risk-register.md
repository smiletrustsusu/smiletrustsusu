# Updated Risk Register (Post-Audit Reconciliation)

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Date:** 2026-09-17  
**Links:** MIB RISK-* items · audit gaps · [`critical-path-report.md`](./critical-path-report.md)

---

## Program risks (active)

| ID | Risk | Level | Status | Mitigation backlog | Owner |
|----|------|-------|--------|--------------------|-------|
| RISK-000001 | Production go-live before mandatory RDY checks | Critical | Planned | TASK-000188, TASK-000191, REL go-live package | Governance / Release |
| RISK-000002 | RBAC bypass in cross-module contracts | High | Planned | BUG-000003, SUPER_ADMIN_FORBIDDEN tests | Security Governance Lead |
| GAP-001 | Cutover never executed / null timestamps | Critical | Blocked item | TASK-000188 | Release Manager |
| GAP-002 | CERT-001 remains preview | Critical | Blocked item | TASK-000191 | Governance Board Chair |
| GAP-003 | Wave 9 human gates open | Critical | Ready item | TASK-000181 | Release Manager |
| GAP-005 | Dual money model data integrity | Critical/High | Planned | BUG-000002 | CIO |
| GAP-007 | No CI / VCS — regressions ungated | High | Planned | TASK-000192 | Platform Administrator |
| GAP-008 | Unsigned EXE / placeholder updater | High | Planned | TASK-000186 | Platform Administrator |
| GAP-010 | SQL roles lag JS RBAC | High | Planned | BUG-000003 | Security Governance Lead |

---

## Risk → response

| Risk theme | Response |
|------------|----------|
| Premature CERT-001 | Keep CERT-001 Blocked until cutover + AA evidence |
| Schema drift | Additive migrations only; money SoT = integer pesewas |
| Channel incomplete | Android Gradle + EXE signing before claiming prod artifacts |
| Process ungated | CI on PR before expanding contributors |
| Duplicate greenfield | Cancelled obsolete “restart waves” task |

---

## Residual accepted risks (documented)

| Residual | Until |
|----------|-------|
| CSP unsafe-inline/eval | TASK-000196 complete |
| Deep loan/GL rewrite deferred | CR-000002 product decision |
| www/ mirror drift | TASK-000193 + CI |

---

*updated-risk-register.md v1.0.0 — 2026-09-17*
