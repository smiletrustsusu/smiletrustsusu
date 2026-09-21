# Dual money model — additive safety plan (GAP-005)

**Status:** Analysis + guards (In Progress) — **no live money math change**  
**Date:** 2026-09-18  
**SoT (application):** integer **pesewas** in `src/core/money.js`  
**Invariants preserved:** interest **15**, collection days **31**, cashier float **GHS 1000** (= 100000 pesewas)

---

## Problem

| Layer | Representation | Risk |
|-------|----------------|------|
| JS SPA / Electron / Capacitor | Integer pesewas (`amountPesewas`, `toPesewas` / `fromPesewas`) | Authoritative for posting |
| Early SQL (`001` collections etc.) | `numeric(14,2)` GHS + later generated/companion pesewas | Dual write if both treated as SoT |
| Later migrations / MoMo webhooks | Some `numeric` amount columns | GAP-019 related |

Treating float GHS as authoritative in SQL while JS posts pesewas can drift by rounding.

---

## Mapping (do not invert)

```
1 GHS = 100 pesewas
GHS → pesewas: Math.round(ghs * 100)   // toPesewas()
pesewas → GHS: pesewas / 100           // fromPesewas() — display / legacy columns only

Cashier default: 1000 GHS = 100_000 pesewas
Interest rate: 15 (percent; product-level, not money units)
Collection days: 31
```

| Field pattern | Treat as | Notes |
|---------------|----------|-------|
| `amountPesewas`, `*_pesewas`, bigint money | **Write SoT** | Prefer for all new RPC params |
| `amount`, `numeric(14,2)` GHS | Display / legacy / generated | Derive from pesewas when both present |
| MoMo provider amount (major units) | Convert at boundary | `toPesewas(providerAmount)` before post |

---

## Additive safety (allowed now)

1. Document mapping (this file).
2. JS guards: reject non-integer pesewas on write paths (`assertPesewasInteger`).
3. Prefer pesewas when dual columns present (`preferPesewasFromRow`).
4. Dual-column recon: `reconcileDualMoneyRow` / `assertDualMoneyConsistent` (detect drift; no SQL rewrite).
5. Write-path normalize: `guardMoneyWritePayload` on local collections/loan repay + Supabase RPC deposit/withdrawal/repay adapters.
6. Cashier float guard: `assertCashierFloatWithinLimit` (default 100000 pesewas).
7. Constants: `INTEREST_PERCENT_DEFAULT=15`, `COLLECTION_DAYS_DEFAULT=31`, `CASHIER_FLOAT_PESEWAS=100000`.
8. Tests: round-trip GHS↔pesewas; cashier 100000; drift detection; write-guard rejection; no float SoT in `money.js` API.
9. Prefer RPC params named `amount_pesewas` (already in `supabase-rpc-repository.js`).
10. **Column inventory (slice 3–5):** high-risk dual patterns to migrate later (no rewrite yet):
   - `collections` / deposits: `amount` numeric + `amount_pesewas` / `amountPesewas` — **guarded** (local collections + RPC `recordDeposit`)
   - `withdrawal_requests` / withdrawals: `amount` + fee — **guarded** (`createWithdrawalRequest` + RPC `recordWithdrawal`)
   - `loans` principal / disbursement: `principal` + `principalPesewas` — **guarded** (`createLoanApplication`, disbursement transition assert, RPC `recordLoanDisbursement`)
   - `loans` repayments: `amountPaid` / repay path — **guarded** (local repay + RPC `recordLoanRepayment`)
   - `transactions` / ledger: `amount` vs `amountPesewas` (double-entry already stores both; inventory for freeze)
   - MoMo / webhook payloads: major-unit amounts converted at boundary (`toPesewas` / `normalizeProviderAmountToPesewas`) — GAP-019 inventory + JS hooks; SQL still freeze
   - Cashier float config: must remain **100000** pesewas (GHS 1000)

### Dual-model inventory progress (no SQL rewrite)

| Area | Write guard | SQL rewrite |
|------|-------------|-------------|
| Collections / Susu deposit | Done | Freeze |
| Withdrawal request + fee | Done | Freeze |
| Loan principal create | Done | Freeze |
| Loan disbursement transition + RPC adapter | Done | Freeze |
| Loan repayment | Done | Freeze |
| MoMo webhook numeric | Boundary `amountPesewas` (GAP-019 In Progress) | GAP-019 / freeze |
| Ledger dual columns | Prefer pesewas on read | Freeze |

## Not allowed without freeze + CIO sign-off

- Dropping or rewriting live `numeric(14,2)` columns
- Changing interest 15 / days 31 / cashier 1000 defaults
- Making SQL triggers the exclusive poster while JS still posts (double-post risk)
- Flipping MoMo webhook schema without GAP-019 coordination

---

## Recommended later migration (freeze required)

1. Inventory all money columns (`docs/audit` + `supabase/migrations`).
2. For each table: ensure bigint pesewas column exists; backfill `round(amount * 100)`.
3. Make generated GHS columns read-only expressions of pesewas (or reverse: keep GHS generated from pesewas).
4. Stop accepting float-only writes in RPCs (require `amount_pesewas`).
5. Recon report: sum(pesewas) vs sum(round(ghs*100)) must be 0 deltas.
6. Only then mark BUG-000002 / GAP-005 **Completed**.

---

## Acceptance (this slice)

- [x] Mapping documented
- [x] Guards + tests additive (`assertPesewasInteger`, `preferPesewasFromRow`, dual recon)
- [x] Write-path `guardMoneyWritePayload` on local + RPC adapters (no SQL rewrite)
- [x] Withdrawal / loan principal / disbursement adapters guarded (slice 5)
- [ ] Authoritative SQL write path fully pesewas (future)
- [ ] Float authoritative writes stopped in all RPCs (future)
