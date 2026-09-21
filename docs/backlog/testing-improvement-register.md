# Testing Improvement Register

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Date:** 2026-09-17  
**Type:** `workCategory = Testing`  
**Scorecard:** Testing ~78; primary gap is **no CI gate** (GAP-007), not missing unit suites

---

## Testing backlog items

| ID | Gap / link | Title | Status | Priority | Wave | Owner |
|----|------------|-------|--------|----------|------|-------|
| TASK-000192 | GAP-007 | Establish VCS remote + CI (npm test + wave validators) | Planned | High | 1 Foundation | Platform Administrator |
| TEST-000007 | GAP-020 / coverage | Audit gap → backlog mapping coverage | Completed | Medium | 8 Testing | Release Manager |
| TASK-000189 | GAP-009 | PV-* business acceptance (human + evidence) | Blocked | High | 10 Production | Release Manager |
| TASK-000182 | GAP-015 | MFA path proven in UAT + PV | Ready | Medium | 9 Pilot | Security Governance Lead |

Existing Completed TEST seeds (MIB consistency, money invariants, module posting) remain **Completed** — do not re-open.

---

## Test / root-cause links (defects)

| Defect | Module | Phase | Test / evidence link | Root cause (audit) |
|--------|--------|-------|----------------------|--------------------|
| BUG-000002 | MOD-006 | PH-007 | Money invariant pack; recon tests TBD | Dual money schema drift |
| BUG-000003 | MOD-001 | PH-009 | RBAC tests; additive migration TBD | SQL CHECK lag vs JS roles |
| BUG-000004 | MOD-016 | PH-007 | Payment/MoMo tests | Webhook numeric vs pesewas |

---

## CI target (GAP-007)

On every PR:

1. `npm test`  
2. `validate:rc` / `validate:pilot` / `validate:golive` as applicable  
3. www/ SoT guard (GAP-018)  

---

*testing-improvement-register.md v1.0.0 — 2026-09-17*
