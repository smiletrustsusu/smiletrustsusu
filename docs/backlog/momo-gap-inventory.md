# GAP-019 — MoMo / Payment integration inventory

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Gap:** GAP-019 → **BUG-000004**  
**Depends on:** GAP-005 / BUG-000002 (money dual-model freeze)  
**Date:** 2026-09-20  
**Scope:** Inventory + boundary hooks only — no live MoMo API keys, no live payment calls, no SQL column rewrite

---

## Spec baseline (Module 16 / Phase payment)

| Source | Expectation |
|--------|-------------|
| `docs/payment-engine.md` | Only path to MTN / Telecel / AirtelTigo / banks; adapters do not execute wallets or collect PINs |
| Module catalog MOD-016 | Payment lifecycle + webhook ingest; no second Susu collection post on callback |
| Money SoT (`docs/money-dual-model-plan.md`) | Integer **pesewas** authoritative in JS; provider major-unit GHS converted at boundary via `toPesewas` |
| Invariants | Interest **15**, collection days **31**, cashier float **GHS 1000** |

---

## Current implementation map

| Layer | Path | State |
|-------|------|-------|
| Reference validation | `src/core/momo.js` | Present — format + duplicate ref; no amount units |
| Webhook parse / verify | `src/core/momo-webhook.js` | Present — idempotent verify by reference; **amount parsed as `Number` (GHS major)** |
| Payment orchestration | `src/core/payment-ops.js` | Present — adapters `executeTransfer: false`; callbacks HMAC + idempotency; uses `toPesewas` on **outbound** payment rows |
| Lifecycle SM | `src/core/payment-lifecycle.js` | Present — states/transitions |
| UI extras | `src/ui/payment-views.js` | Present — below existing Collections controls |
| SQL webhook table | `supabase/migrations/005_production_auth_rls.sql` | `momo_webhook_events.amount numeric(14,2)` — **GHS float column** |
| SQL RPC | `record_momo_webhook` | Inserts `payload->>'amount'` as numeric; verifies collection by **reference only** (no amount match) |
| Payments migration | `025_payments.sql` | `gross_amount numeric` and related — dual-model / freeze |
| Tests | `tests/momo.test.js`, `tests/payment-ops.test.js`, `tests/idempotency.test.js` | Ref + callback idempotency; **no pesewas webhook unit tests historically** |
| Secrets | `settings.momoWebhookSecret` / business column | HMAC pattern only — no provider API keys in repo |

---

## Gap vs Module / Phase specs

| # | Spec requirement | Current | Gap |
|---|------------------|---------|-----|
| G1 | Provider amounts → integer pesewas at trust boundary | JS parse keeps major-unit `amount`; SQL stores `numeric(14,2)` | **Open** — boundary helper added; SQL rewrite **freeze** |
| G2 | Callback must not invent second collection / ledger post | Verified — marks `verificationStatus` only | Closed |
| G3 | No MoMo PIN / bank password storage | Forbidden in callback + docs | Closed |
| G4 | Adapters do not execute wallet transfer | `executeTransfer: false`; outbound metadata only | Closed |
| G5 | Idempotent webhook / duplicate callback safe | `processMomoCallback` + payment callback keys | Closed |
| G6 | Amount match collection before verify | Reference-only match in JS + SQL | **Open** — optional JS mismatch helper; SQL unchanged |
| G7 | Live provider initiate / settle | Not implemented (correct for pilot) | Deferred — needs org credentials (not this slice) |
| G8 | Settlement file recon / refunds | Engine stubs exist; not production-proven | Deferred / product |
| G9 | Align SQL `momo_webhook_events.amount` to pesewas bigint | Still `numeric(14,2)` | **Blocked** by migration freeze + GAP-005 |

---

## Honest status (BUG-000004)

| Status | Meaning |
|--------|---------|
| **In Progress** | Inventory documented; JS boundary exposes `amountPesewas`; tests cover parse conversion |
| **Not Completed** | SQL webhook column + `record_momo_webhook` still GHS numeric; no live provider; amount-match not enforced in SQL |
| **Blocked for Complete** | GAP-005 freeze lift + CIO sign-off for additive migration; org MoMo credentials for live UAT (separate from this defect) |

---

## Allowed next technical steps (freeze-safe)

1. Keep converting provider major units with `toPesewas` / `normalizeProviderAmountToPesewas` at parse boundary.
2. Prefer `webhook.amountPesewas` in fingerprints / recon helpers (additive).
3. Optional soft amount check in JS when collection already has pesewas/GHS.
4. Additive migration later: `amount_pesewas bigint` companion column + backfill — **do not drop** `numeric(14,2)` without freeze plan.
5. Extend payment-ops tests; never commit real API keys or call live gateways from CI.

## Forbidden without explicit org/CIO approval

- Rewriting `momo_webhook_events.amount` in place
- Hardcoding MTN/Telecel/AirtelTigo API keys or sandbox secrets into the repo
- Marking electronic payments completed without validated callback / statement path
- Claiming BUG-000004 / GAP-019 **Completed** while SQL remains float-authoritative

---

## Cross-links

- Dual money plan: [`../money-dual-model-plan.md`](../money-dual-model-plan.md)
- Audit row: [`../audit/gap-register.md`](../audit/gap-register.md) GAP-019
- Reconciled map: [`gap-register-reconciled.md`](./gap-register-reconciled.md)
- Payment engine: [`../payment-engine.md`](../payment-engine.md)

---

*momo-gap-inventory.md v1.0.0 — 2026-09-20*
