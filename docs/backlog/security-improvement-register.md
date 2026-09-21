# Security Improvement Register

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Date:** 2026-09-17  
**Type:** `workCategory = Security`  
**Companion:** [`../audit/compliance-scorecard.md`](../audit/compliance-scorecard.md) (Security controls ~74)

---

## Security backlog items

| ID | Gap | Title | Status | Priority | Wave | Owner |
|----|-----|-------|--------|----------|------|-------|
| BUG-000003 | GAP-010 | Expand SQL `app_users.role` CHECK to JS RBAC | Planned | High | 2 Database | Security Governance Lead |
| TASK-000186 | GAP-008 | Electron code signing + production update channel | Planned | High | 6 Windows | Platform Administrator |
| TASK-000182 | GAP-015 | Prove MFA enroll/challenge in UAT + PV | Ready | Medium | 9 Pilot | Security Governance Lead |
| TASK-000196 | GAP-014 | Tighten Electron CSP (unsafe-inline/eval) | Planned | Medium | 6 Windows | Security Governance Lead |
| TASK-000200 | GAP-024 | productionMode fail-closed for bootstrap passwords | Completed | Low | 10 Production | Security Governance Lead |
| RISK-000002 | — | RBAC bypass in cross-module contracts | Planned | High | — | Security Governance Lead |

---

## Governance-linked security gates

| Gap | Backlog | Note |
|-----|---------|------|
| GAP-003 | TASK-000181 | Security acceptance is one of the Wave 9 HA-* human gates |
| GAP-002 | TASK-000191 | CERT-001 AA certification (Blocked on cutover) |

---

## Severity × production impact

| Priority | Focus |
|----------|--------|
| High | Role CHECK drift, EXE signing/update channel |
| Medium | MFA proof, CSP hardening |
| Low | Bootstrap password guard (**Completed** in-repo; org must still set live secrets) |

**Invariant:** `SUPER_ADMIN_FORBIDDEN` and cashier float **1000** must not regress.

---

*security-improvement-register.md v1.0.0 — 2026-09-17*
