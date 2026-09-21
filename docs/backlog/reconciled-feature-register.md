# Reconciled Feature Register

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Date:** 2026-09-17  
**Scope:** Feature / CR / enhancement work after enterprise audit reconciliation  
**Companion:** [`gap-register-reconciled.md`](./gap-register-reconciled.md) · MIB v1.1.0

---

## Framing

Waves **1–10** framework packs are **Mostly Complete**. This register does **not** re-open Completed module anchors. Open feature work is:

1. Audit-driven enhancements (GAP-025…027)  
2. Deferred deep rewrites (GAP-017) that stay product-gated  
3. Existing MIB FEAT/USR under module hardening still **Planned** (not duplicated here)

---

## Feature / enhancement items (audit)

| ID | Title | Status | Priority | Wave | Module | Gap |
|----|-------|--------|----------|------|--------|-----|
| FEAT-000187 | Optional thin Kotlin bridges (biometrics, WorkManager) | Deferred | Low | 4 Android | MOD-015 | GAP-025 |
| CR-000002 | Deep loan state-machine / CoA-GL rewrite (Mods 8 & 10) | Deferred | Medium | 6 Windows | MOD-008 | GAP-017 |
| CR-000003 | Post-go-live continuous improvement → MIB identifiers | Deferred | Low | 10 Production | MOD-030 | GAP-027 |
| TASK-000201 | Broader OpenAPI coverage from route-registry | Deferred | Low | 3 Backend | MOD-020 | GAP-026 |

---

## Existing FEAT inventory (post-reconciliation)

| Metric | Count |
|--------|------:|
| FEAT total | 187 |
| Completed (canonical) | see `backlogStatusSummary().byStatus` |
| New FEAT from audit | 1 (FEAT-000187) + category bucket features under audit epic |

**Rule:** Do not create parallel FEATs for the same gap. Use [`gap-register-reconciled.md`](./gap-register-reconciled.md).

---

## Prioritization (business value)

| Rank | Work | Why |
|-----:|------|-----|
| 1 | Human gates + cutover (not features) | Unblocks CERT-001 |
| 2 | Money / RBAC schema defects | Production data integrity |
| 3 | Android + EXE signing | Channel release evidence |
| 4 | CI / www guard | Delivery hygiene |
| 5 | GAP-017 / 025 / 026 / 027 | Product enhancements — after go-live |

---

*reconciled-feature-register.md v1.0.0 — 2026-09-17*
