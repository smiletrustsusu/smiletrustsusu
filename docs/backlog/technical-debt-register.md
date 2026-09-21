# Technical Debt Register

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Date:** 2026-09-17  
**Type:** `workCategory = TechDebt` (tracked in MIB; separate from feature delivery)  
**Source:** Enterprise audit gaps + residual architecture notes

Tracked **separately from features** but still in the Master Backlog with clear `workCategory`.

---

## Active tech debt

| ID | Gap | Title | Status | Priority | Wave | Owner | Area |
|----|-----|-------|--------|----------|------|-------|------|
| BUG-000002 | GAP-005 | Dual money model (numeric GHS vs integer pesewas) | In Progress | High | 2 Database | CIO | Architecture / Data |
| BUG-000004 | GAP-019 | MoMo webhook amount numeric vs pesewas | In Progress | Medium | 2 Database | CIO | Data / Payments |
| TASK-000195 | GAP-013 | Remaining posting paths via invokeApi | Deferred | Medium | 3 Backend | CIO | Architecture |
| TASK-000193 | GAP-018 | CI guard: forbid hand-edits to www/ | Completed | Medium | 1 Foundation | Platform Administrator | Quality / SoT |
| CR-000002 | GAP-017 | Deep loan SM / CoA-GL rewrite | Deferred | Medium | 6 Windows | CIO | Refactor / Legacy |
| TASK-000197 | GAP-021 | package.json MODULE_TYPELESS | Deferred | Low | 1 Foundation | Platform Administrator | Tooling |
| BUG-000001 | — | Payment gateway edge-case tracker (legacy) | Deferred | Medium | — | — | Superseded by BUG-000004 for primary |

---

## Categories

| Category | Items | Notes |
|----------|-------|-------|
| Architecture | GAP-013, GAP-017 | Shared engines remain SoT; no stack rewrite |
| Data / money | GAP-005, GAP-019 | Additive migrations only |
| Quality / SoT | GAP-018, GAP-021 | EDSM `prepare:web` discipline |
| Legacy cleanup | GAP-017 | Explicitly **not** a Wave restart |

---

## Exit criteria (debt)

1. Integer-pesewas write path authoritative (GAP-005) with recon tests  
2. MoMo webhook aligned (GAP-019) — inventory + JS boundary In Progress; SQL still freeze  
3. ~~www/ edit guard in CI (GAP-018)~~ **Completed** (`check:www-sot`)  
4. Loan/GL deep rewrite only via approved CR-000002  

---

*technical-debt-register.md v1.0.0 — 2026-09-17*
