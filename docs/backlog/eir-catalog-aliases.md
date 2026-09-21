# EIR historical catalog name aliases (GAP-022)

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Backlog:** TASK-000198  
**Rule:** Keep aliases for agent/human navigation. **Do not rename** delivery engines, wave IDs (`WAVE-01`…`WAVE-10`), or MIB wave numbers.

Related: [`../enterprise-implementation-roadmap.md`](../enterprise-implementation-roadmap.md) · [`../eir-catalogs.md`](../eir-catalogs.md) · `src/core/enterprise-roadmap-registry.js`

---

## Alias table (historical → delivery)

| Historical EIR / catalog name | Code (if any) | Current delivery name | EIR ID | Notes |
|-------------------------------|---------------|----------------------|--------|-------|
| Loan Platform | `LOAN_PLATFORM` | Windows Desktop EXE | WAVE-06 | MIB wave 10 LOANS / Module 8 stay mapped here; deep loan SM is GAP-017 Deferred |
| Accounting Platform | — | Enterprise Analytics & BI | WAVE-07 | MIB wave 11 ACCOUNTING / Module 10 mapped; CoA-GL rewrite Deferred |
| Reporting Platform | — | Release Certification (RC1) | WAVE-08 | MIB waves 12–13; full CERT-001 is WAVE-10 |
| Enterprise Features | `ENTERPRISE_FEATURES` | Pilot / UAT / Ops Readiness | WAVE-09 | MIB waves 14–17 |
| Production Readiness | `PRODUCTION_READINESS` | Prod Deploy / Go-Live / Hypercare / Closure | WAVE-10 | Framework complete ≠ live certified |

User-facing wave names (Foundation · Database · Backend · Android · Web · Windows · AI & Analytics · Testing · Pilot · Production) map 1:1 to WAVE-01…WAVE-10 in `docs/backlog/wave-execution-plan.md`.

---

## Agent guidance

1. Prefer **delivery names** and stable `WAVE-*` IDs in new docs and tickets.  
2. When older prose says “Loan Platform” / “Accounting Platform” / “Production Readiness”, treat as the aliases above — **not** a second product.  
3. Never invent a parallel roadmap or rename engines to “fix” catalog drift.  
4. UI already surfaces short catalog notes under Audit/Reports (EXE / Analytics panels).

---

## Acceptance (GAP-022)

- [x] Alias notes published (this file + EIR / eir-catalogs pointers)  
- [x] Engines / WAVE IDs not renamed  
- [x] User delivery wave names linked from backlog plan  

---

*eir-catalog-aliases.md v1.0.0 — 2026-09-20 · TASK-000198 Completed*
