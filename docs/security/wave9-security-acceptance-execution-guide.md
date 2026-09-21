# Wave 9 Security Acceptance Execution Guide — NORTHRISE MICRO SAVINGS pilot

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Pilot:** NORTHRISE MICRO SAVINGS  
**Gate:** HG-04 / GAP-003 — Security Acceptance (HA-SEC)  
**Status:** Executable **9/9** checklist · Signed **0/9** · Pack prepared / PendingHumanSignOff · Current human-gates focus: **HG-05 Executive Sponsor**  
**Do not:** deploy production, modify prod Supabase, apply prod migrations, change production config or financial data, fabricate security findings, or mark HA-SEC **Approved** without typed human names/dates  

Machine SoT: `src/core/wave9-pilot-uat-ops.js` (`SECURITY_CHECKLIST`) · Recording: `src/core/wave9-security-recording.js`  
Run sheet: `docs/release-evidence/wave9-security-run-sheet.json`  
In-app recorder: **Audit** or **Reports** → Pilot / UAT panel → **Security acceptance recorder** (no new top-level nav)

---

## Human-gates context

| Gate | Topic | Status |
|------|-------|--------|
| **HG-01** | Business UAT (HA-PO / HA-QA) | **Deferred by request** — remains `PendingHumanSignOff`; pack ready under [wave9-uat-execution-guide.md](../uat/wave9-uat-execution-guide.md). |
| **HG-02** | Training Completion | **Prepared** — remains `PendingHumanSignOff` until humans finish training evidence ([wave9-training-execution-guide.md](../training/wave9-training-execution-guide.md)). |
| **HG-03** | Financial Reconciliation | **Prepared** — remains `PendingHumanSignOff` until humans finish recon evidence ([wave9-financial-recon-execution-guide.md](../reconciliation/wave9-financial-recon-execution-guide.md)). |
| **HG-04** | Security Acceptance (HA-SEC) | **Prepared** — remains `PendingHumanSignOff` until humans finish (this guide ready). |
| **HG-05** | Executive Sponsor Approval | **Current focus** — [wave9-executive-sponsor-execution-guide.md](../governance/wave9-executive-sponsor-execution-guide.md) |

---

## 1. How to start security acceptance today

1. Open the app (local / pilot web after `npm run prepare:web` if needed — **not** production).
2. **Log in as JOHN** (System Owner / security facilitator oversight).  
   - Security Governance / Compliance execute and sign **HA-SEC**.  
   - **KBA** is developer support only — call KBA only if a platform defect blocks the security walkthrough.  
   - **JOHN must never see or manage the KBA account** (owner/developer isolation).
3. Open **Audit** (or **Reports**).
4. Scroll to **Pilot / UAT / Ops Readiness (Wave 9)** → **Security acceptance recorder (human)**.
5. Optionally click **Reload pilot evidence**, then use the security recorder.
6. Start with **SEC-AUTH-01** (first item below).
7. For each checklist item: walk the steps on **pilot/demo/local** only → set Pass/Fail + finding notes → **Save result**.  
   - Saving Pass/Fail does **not** approve HA-SEC.  
   - Saving Pass/Fail does **not** claim production hardened.  
   - Use **Export for sign-off** to download JSON evidence.  
   - Use **Record HA-SEC sign-off** only when a real Security Governance signer types their name and the confirmation phrase.

**Hard constraints (entire gate):** no production deploy · no prod Supabase changes/migrations · no production config or financial data changes · preserve JOHN/KBA isolation · `SUPER_ADMIN_FORBIDDEN` · money **15 / 31 / 1000** (pesewas).

---

## 2. Roles — who signs what

| Who | Role in security acceptance |
|-----|-----------------------------|
| JOHN | Facilitator oversight / System Owner; may record checklist results; never auto-approves gates |
| Security Governance / Compliance | Primary **HA-SEC** signer after checklist complete with no open Fail/Blocked |
| Branch Manager / Admin | Assists on RBAC / session / branch isolation walkthroughs |
| Auditor | May observe / sample audit logs |
| KBA | Developer support only — hidden from JOHN |

**What Security Governance signs (HA-SEC):**  
That the **pilot security checklist was executed**, findings (if any) are **documented/remediated**, and the **pilot/demo security posture** is accepted for Wave 9 evidence — **not** that production is hardened unless separate production evidence exists (out of scope; do not flip `productionHardenedClaim`).

---

## 3. Recording fields (every checklist item)

| Field | Values |
|-------|--------|
| Pass/Fail | `pass` \| `fail` \| `blocked` |
| Finding notes | Required when Fail/Blocked |
| Evidence | Screenshot id, export path, audit log ref, RLS review note |
| Executed by / signer name | Operator + optional line signer |
| HA-SEC | Separate path: typed name + phrase `I CONFIRM SECURITY ACCEPTANCE` |

**Hard rules:**  
- Checklist saves never approve HA-SEC.  
- Gate sign-off requires all 9 items recorded **and** zero Fail/Blocked remaining.  
- Gate sign-off never sets `productionHardenedClaim` to `true`.  
- Approved gates without a typed signer name must be treated as PendingHumanSignOff.

---

## 4. Checklist scripts (9 / 9)

### SEC-AUTH-01 — Authentication controls
- **Category:** auth · **Signers:** Security Governance + JOHN oversight
- **Preconditions:** Pilot/local app; test non-developer account available
- **Steps:**
  1. Attempt valid login for a non-developer role
  2. Attempt invalid password; confirm denial without leaking account existence
  3. Logout; confirm protected views require re-auth
- **Expected:** Valid login succeeds; invalid denied; logout requires re-auth
- **Pass/Fail:** ________  **Evidence:** ________  **Signer:** ________  **Date:** ________

### SEC-RBAC-01 — RBAC and SUPER_ADMIN_FORBIDDEN
- **Category:** rbac · **Signers:** Security Governance
- **Preconditions:** Restricted role (e.g. Cashier) and Admin contrast available on pilot
- **Steps:**
  1. As restricted role, attempt Admin-only actions
  2. Confirm denials in UI and that deep links cannot force access
  3. Confirm `SUPER_ADMIN_FORBIDDEN` includes System.Reset and related forbidden ops
- **Expected:** Least-privilege holds; SUPER_ADMIN_FORBIDDEN enforced
- **Pass/Fail:** ________  **Evidence:** ________  **Signer:** ________  **Date:** ________

### SEC-TENANT-01 — Tenant / branch isolation
- **Category:** isolation · **Signers:** Security Governance + Branch Manager
- **Preconditions:** At least two branch/tenant scopes in pilot/demo (or documented single-scope limitation)
- **Steps:**
  1. As branch-scoped user, open customers/collections for own branch
  2. Attempt cross-branch/tenant access via UI or URL params (**pilot only**)
  3. Confirm foreign tenant/branch data is not returned
- **Expected:** Users only see their tenant/branch scope
- **Pass/Fail:** ________  **Evidence:** ________  **Signer:** ________  **Date:** ________

### SEC-JOHN-KBA-01 — JOHN cannot see KBA
- **Category:** isolation · **Signers:** JOHN + Security Governance observer
- **Preconditions:** JOHN and KBA accounts exist; isolation helpers active
- **Steps:**
  1. Log in as JOHN
  2. Open user administration / account pickers
  3. Confirm KBA does not appear and cannot be managed
- **Expected:** JOHN never sees KBA; developer account remains isolated
- **Pass/Fail:** ________  **Evidence:** ________  **Signer:** ________  **Date:** ________

### SEC-SESSION-01 — Session handling
- **Category:** session · **Signers:** Security Governance
- **Preconditions:** Pilot session / logout (and revoke if available)
- **Steps:**
  1. Confirm idle or explicit logout ends access to Audit/Reports and money screens
  2. If device/session revoke exists in pilot, revoke a test session and confirm lockout
  3. Confirm re-login required after revoke
- **Expected:** Sessions end cleanly; revoke (if present) locks the session
- **Pass/Fail:** ________  **Evidence:** ________  **Signer:** ________  **Date:** ________

### SEC-AUDIT-01 — Audit logging
- **Category:** audit · **Signers:** Auditor / Security Governance
- **Preconditions:** Audit view accessible to authorized role on pilot
- **Steps:**
  1. Perform a sensitive action (failed login, permission denial, or pilot money post)
  2. Locate corresponding audit/event record
  3. Confirm actor, action, timestamp present; no passwords/secrets in the log
- **Expected:** Sensitive actions produce audit evidence without leaking secrets
- **Pass/Fail:** ________  **Evidence:** ________  **Signer:** ________  **Date:** ________

### SEC-ENCRYPT-01 — Encryption / offline queue
- **Category:** encryption · **Signers:** Security Governance + Platform Admin (if present)
- **Preconditions:** Offline queue / sync path available on pilot/local — **not** production
- **Steps:**
  1. Capture a sample offline queue / sync payload path on pilot/local
  2. Confirm sensitive fields are not cleartext where encryption is expected
  3. Confirm queue sync does not expose other tenants' data
- **Expected:** Offline queue respects encryption/isolation expectations for pilot
- **Pass/Fail:** ________  **Evidence:** ________  **Signer:** ________  **Date:** ________

### SEC-ISSUES-01 — No Critical/High unresolved (pilot)
- **Category:** issues · **Signers:** Security Governance
- **Preconditions:** Wave 9 issue register / security findings for this pilot
- **Steps:**
  1. Review open issues/findings for NORTHRISE MICRO SAVINGS pilot
  2. Confirm no open **Critical** or **High** security findings remain for pilot go
  3. Document any waived Medium/Low with owner and date
- **Expected:** Zero open Critical/High security findings for pilot acceptance
- **Pass/Fail:** ________  **Register ref:** ________  **Signer:** ________  **Date:** ________

### SEC-RLS-01 — RLS notes for pilot env (no prod migrate)
- **Category:** rls · **Signers:** Security Governance + Platform Admin
- **Preconditions:** Access to pilot/local RLS notes only
- **Steps:**
  1. Confirm this check is pilot/local only — **do not** apply production migrations
  2. Review RLS / row-scope notes for the Wave 9 pilot Supabase (or local) env
  3. Record that production RLS/migrations remain out of scope and untouched
- **Expected:** Pilot RLS posture documented; no production migrations from this gate
- **Pass/Fail:** ________  **Notes:** ________  **Signer:** ________  **Date:** ________

---

## 5. How to record evidence

1. In the **Security acceptance recorder**, for each item set Pass/Fail, finding notes, executed by → **Save**.
2. Click **Export for sign-off** → save JSON with the pilot evidence packet.
3. When all 9 items are recorded **and** none are Fail/Blocked, Security Governance uses **Record HA-SEC sign-off** with:
   - Typed full name  
   - Exact phrase: `I CONFIRM SECURITY ACCEPTANCE`
4. Humans then update `docs/release-evidence/wave9-pilot-evidence.json` `humanApprovals` for HA-SEC with the **same** names/dates (never agent-fabricated).
5. Leave `claim.productionHardenedClaim` **false** unless a separate, real production security package exists (out of scope here).

---

## 6. After HG-04

1. File defects for any `fail` / `blocked` items before treating Wave 9 security acceptance as closed.
2. Continue the HG-04 checklist in `docs/backlog/human-gates-runbook.md`.
3. Proceed to **HG-05 Executive Sponsor Approval** (HA-EXEC / HA-W9-EXEC) — **current focus**: [wave9-executive-sponsor-execution-guide.md](../governance/wave9-executive-sponsor-execution-guide.md).

---

## 7. Related docs

- [wave9-uat-execution-guide.md](../uat/wave9-uat-execution-guide.md) (HG-01 deferred)
- [wave9-training-execution-guide.md](../training/wave9-training-execution-guide.md) (HG-02 prepared / pending)
- [wave9-financial-recon-execution-guide.md](../reconciliation/wave9-financial-recon-execution-guide.md) (HG-03 prepared / pending)
- [human-gates-runbook.md](../backlog/human-gates-runbook.md)
- [critical-path-report.md](../backlog/critical-path-report.md)
- Run sheet: [wave9-security-run-sheet.json](../release-evidence/wave9-security-run-sheet.json)

*Wave 9 security acceptance execution guide — prepared for human pilot execution; no fake HA-SEC approval; no production harden claim.*
