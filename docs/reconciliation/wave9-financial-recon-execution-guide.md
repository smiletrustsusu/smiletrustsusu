# Wave 9 Financial Reconciliation Execution Guide — NORTHRISE MICRO SAVINGS pilot

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Pilot:** NORTHRISE MICRO SAVINGS  
**Gate:** HG-03 / GAP-003 — Financial Reconciliation (HA-RECON / HA-FIN)  
**Status:** Executable **8/8** checklist · Signed **0/8** · Ready for human execution  
**Do not:** deploy production, apply production migrations, change production financial data, fabricate recon totals, or mark HA-RECON / HA-FIN **Approved** without typed human names/dates  
**Hard claim rule:** Never set `claim.productionReconciled: true` from automation or this pack alone  

Machine SoT: `src/core/wave9-pilot-uat-ops.js` (`RECON_CHECKLIST`) · Recording: `src/core/wave9-recon-recording.js`  
Run sheet: `docs/release-evidence/wave9-recon-run-sheet.json`  
In-app recorder: **Audit** or **Reports** → Pilot / UAT panel → **Financial reconciliation recorder** (no new top-level nav)

---

## Human-gates context

| Gate | Topic | Status |
|------|-------|--------|
| **HG-01** | Business UAT (HA-PO / HA-QA) | **Deferred by request** — remains `PendingHumanSignOff`; pack ready under [wave9-uat-execution-guide.md](../uat/wave9-uat-execution-guide.md). |
| **HG-02** | Training Completion | **Prepared** — remains `PendingHumanSignOff` until humans finish training evidence ([wave9-training-execution-guide.md](../training/wave9-training-execution-guide.md)). |
| **HG-03** | Financial Reconciliation | **Prepared** — remains `PendingHumanSignOff` until humans finish recon evidence (this guide ready). |
| **HG-04** | Security Acceptance (HA-SEC) | **Prepared** — remains `PendingHumanSignOff` ([wave9-security-acceptance-execution-guide.md](../security/wave9-security-acceptance-execution-guide.md)). |
| **HG-05** | Executive Sponsor Approval | **Current focus** — [wave9-executive-sponsor-execution-guide.md](../governance/wave9-executive-sponsor-execution-guide.md) |

---

## 1. How to start recon today

1. Open the app (local / pilot web after `npm run prepare:web` if needed — **not** production).
2. **Log in as JOHN** (System Owner / recon facilitator oversight).  
   - Finance / Branch Manager execute and sign HA-RECON / HA-FIN.  
   - **KBA** is developer support only — call KBA only if a platform defect blocks recon.  
   - **JOHN must never see or manage the KBA account** (owner/developer isolation).
3. Open **Audit** (or **Reports**).
4. Scroll to **Pilot / UAT / Ops Readiness (Wave 9)** → **Financial reconciliation recorder (human)**.
5. Optionally click **Reload pilot evidence**, then use the recon recorder.
6. Start with **RC-CASHBOOK-01** (first item below).
7. For each checklist item: walk the steps on **pilot/demo/local** data → set Pass/Fail + variance notes → **Save result**.  
   - Saving Pass/Fail does **not** approve HA-RECON / HA-FIN.  
   - Saving Pass/Fail does **not** set `productionReconciled: true`.  
   - Use **Export for sign-off** to download JSON evidence.  
   - Use **Record HA-RECON / HA-FIN sign-off** only when a real Finance/Branch Manager types their name and the confirmation phrase.

Money invariants (must hold throughout): **pesewas** · interest **15** · collection days **31** · cashier float **1000** GHS.

---

## 2. Roles — who signs what

| Who | Role in recon |
|-----|----------------|
| JOHN | Facilitator oversight / System Owner; may record checklist results; never auto-approves gates |
| Cashier / Teller | Physical till count; float worksheet (limit 1000 GHS) |
| Collector | Route sheet totals for RC-COLL-01 |
| Branch Manager | Oversees EOD; co-signs or owns HA-RECON as applicable |
| Finance | Primary HA-RECON / HA-FIN signer after worksheet complete |
| Auditor | May observe / sample; does not fake production reconciled |
| KBA | Developer support only — hidden from JOHN |

**What Finance / Branch Manager signs (HA-RECON / HA-FIN):**  
That the **checklist was executed**, variances (if any) are **documented**, and the **pilot/demo recon procedure** is accepted for Wave 9 evidence — **not** that live production ledgers are reconciled unless separate production evidence exists (out of scope for this pack; do not flip `productionReconciled`).

---

## 3. Pesewas / GHS display notes

| Rule | Detail |
|------|--------|
| Authoritative unit | Integer **pesewas** (never float as SoT) |
| Display | GHS = pesewas ÷ 100 (e.g. 100000 pesewas = GHS 1,000.00) |
| Cashier float limit | **1000 GHS** = **100000 pesewas** |
| Variance entry | Enter variance as **integer pesewas** in the recorder; UI/export may show GHS alongside |
| Dual columns | If both pesewas and GHS appear, they must agree within half a pesewa — prefer pesewas |
| Interest / days | Confirm policy interest **15** and collection days **31** on RC-POLICY-01 |

Do **not** invent signed totals in the run sheet JSON. Leave totals `null` until humans measure them.

---

## 4. Recording fields (every checklist item)

| Field | Values |
|-------|--------|
| Pass/Fail | `pass` \| `fail` \| `blocked` |
| Variance (pesewas) | Integer difference (physical − system) or 0 |
| Variance notes | Required when Fail/Blocked |
| System / physical totals | Optional integer pesewas measured by humans |
| Evidence | Screenshot id, export path, worksheet ref |
| Executed by / signer name | Operator + optional line signer |
| HA-RECON / HA-FIN | Separate path: typed name + phrase `I CONFIRM FINANCIAL RECONCILIATION` |

**Hard rules:**  
- Checklist saves never approve gates.  
- Gate sign-off never sets `claim.productionReconciled` to `true`.  
- Approved gates without a typed signer name must be treated as PendingHumanSignOff.

---

## 5. Checklist scripts (8 / 8)

### RC-CASHBOOK-01 — Cashbook vs system cash postings
- **Category:** cashbook · **Signers:** Cashier + Finance reviewer
- **Preconditions:** Day transactions posted; cashbook/till worksheet available (pilot/demo OK)
- **Steps:**
  1. Export day's cash receipts/payments from system (pesewas)
  2. Compare to physical cashbook / till worksheet totals
  3. Record variance in pesewas (and note GHS display)
- **Expected:** Cashbook and system cash agree, or variance is documented
- **Pass/Fail:** ________  **Variance (pesewas):** ________  **Signer:** ________  **Date:** ________

### RC-COLL-01 — Collections sheets vs posted collections
- **Category:** collections · **Signers:** Collector + Branch Manager
- **Preconditions:** Collector route sheets for the recon day; collections posted
- **Steps:**
  1. Sum collector route sheets for the day (pesewas)
  2. Compare to posted collection totals in system
  3. Confirm collection-day cycle awareness (**31** days)
- **Expected:** Sheet totals match posted collections, or variance documented
- **Pass/Fail:** ________  **Variance (pesewas):** ________  **Signer:** ________  **Date:** ________

### RC-BAL-01 — Customer balances vs ledger sum
- **Category:** balances · **Signers:** Finance
- **Preconditions:** Customer balance export / trial available (pilot/demo OK)
- **Steps:**
  1. Export customer savings balances (pesewas SoT)
  2. Compare sample accounts and control-total sum to trial/ledger
  3. Spot-check dual GHS display equals pesewas ÷ 100
- **Expected:** Control totals agree; dual money columns consistent
- **Pass/Fail:** ________  **Variance (pesewas):** ________  **Signer:** ________  **Date:** ________

### RC-VAULT-01 — Vault float physical vs system
- **Category:** vault · **Signers:** Branch Manager + Finance
- **Preconditions:** Vault access; vault float visible in system
- **Steps:**
  1. Count vault cash physically
  2. Compare to vault float balance in system (pesewas)
  3. Document any difference before EOD close
- **Expected:** Vault physical equals system, or variance escalated
- **Pass/Fail:** ________  **Variance (pesewas):** ________  **Signer:** ________  **Date:** ________

### RC-TELLER-01 — Teller / cashier floats (limit 1000 GHS)
- **Category:** teller · **Signers:** Cashier + Branch Manager
- **Preconditions:** Teller floats open or EOD till worksheets
- **Steps:**
  1. List each teller/cashier float balance (pesewas)
  2. Confirm no open float above **1000 GHS** (100000 pesewas) without escalation
  3. Reconcile till cash to system float
- **Expected:** Floats within policy; limit 1000 enforced or escalated
- **Pass/Fail:** ________  **Variance (pesewas):** ________  **Signer:** ________  **Date:** ________

### RC-EOD-01 — EOD close and day totals
- **Category:** eod · **Signers:** Branch Manager
- **Preconditions:** Cashbook, collections, and floats reconciled or variances logged
- **Steps:**
  1. Run EOD checklist after prior items agree (or variances owned)
  2. Capture day totals and close status
  3. Attach EOD evidence path or screenshot id in the recorder
- **Expected:** EOD closed with recon worksheet attached
- **Pass/Fail:** ________  **Evidence:** ________  **Signer:** ________  **Date:** ________

### RC-POLICY-01 — Money policy invariants (15 / 31 / pesewas)
- **Category:** policy · **Signers:** Finance / JOHN oversight
- **Preconditions:** Product/policy screens readable in pilot
- **Steps:**
  1. Confirm default interest policy remains **15**
  2. Confirm collection days remain **31**
  3. Confirm amounts compared in integer pesewas
- **Expected:** interest=15, collectionDays=31, pesewas authoritative
- **Pass/Fail:** ________  **Notes:** ________  **Signer:** ________  **Date:** ________

### RC-VAR-01 — Variances documented and escalated
- **Category:** variances · **Signers:** Finance
- **Preconditions:** Prior checklist items recorded
- **Steps:**
  1. List every non-zero variance with pesewas + GHS display
  2. Assign owner and next action
  3. Do **not** claim `productionReconciled` while variances are open (or from this pack alone)
- **Expected:** Variance register complete; no silent write-offs
- **Pass/Fail:** ________  **Variance register ref:** ________  **Signer:** ________  **Date:** ________

---

## 6. How to record evidence

1. In the **Financial reconciliation recorder**, for each item set Pass/Fail, optional variance pesewas, notes, executed by → **Save**.
2. Click **Export for sign-off** → save JSON with the pilot evidence packet.
3. When all 8 items are recorded, Finance/Branch Manager uses **Record HA-RECON sign-off** (and **HA-FIN** if required) with:
   - Typed full name  
   - Exact phrase: `I CONFIRM FINANCIAL RECONCILIATION`
4. Humans then update `docs/release-evidence/wave9-pilot-evidence.json` `humanApprovals` for HA-RECON with the **same** names/dates (never agent-fabricated).
5. Leave `claim.productionReconciled` **false** unless a separate, real production recon package exists (out of scope here).

---

## 7. After HG-03

1. File defects for any `fail` / `blocked` items before treating Wave 9 recon as closed.
2. Continue the HG-03 checklist in `docs/backlog/human-gates-runbook.md`.
3. Proceed to **HG-04 Security Acceptance** (HA-SEC) — pack: [wave9-security-acceptance-execution-guide.md](../security/wave9-security-acceptance-execution-guide.md).

---

## 8. Related docs

- [wave9-uat-execution-guide.md](../uat/wave9-uat-execution-guide.md) (HG-01 deferred)
- [wave9-training-execution-guide.md](../training/wave9-training-execution-guide.md) (HG-02 prepared / pending)
- [human-gates-runbook.md](../backlog/human-gates-runbook.md)
- [critical-path-report.md](../backlog/critical-path-report.md)
- [money-dual-model-plan.md](../money-dual-model-plan.md)
- Run sheet: [wave9-recon-run-sheet.json](../release-evidence/wave9-recon-run-sheet.json)

*Wave 9 financial recon execution guide — prepared for human pilot execution; no production reconciled claim.*
