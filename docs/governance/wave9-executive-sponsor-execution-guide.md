# Wave 9 Executive Sponsor Execution Guide — NORTHRISE MICRO SAVINGS pilot

**Product:** SMILE TRUST SUSU MANAGEMENT SYSTEM  
**Pilot:** NORTHRISE MICRO SAVINGS  
**Gate:** HG-05 / GAP-003 — Executive Sponsor Approval (HA-EXEC / HA-W9-EXEC)  
**Status:** Pack **ReadyToExecute** · Decision recorded **0** · HA-EXEC / HA-W9-EXEC **PendingHumanSignOff**  
**Do not:** deploy production, modify prod Supabase, apply prod migrations, fabricate executive signatures, claim Full Go without typed name, mark Wave 10 Accepted / CERT-001 certified from this pack alone  

Machine SoT: `src/core/wave9-executive-recording.js` · Go/No-Go context: `src/core/wave9-pilot-uat-ops.js`  
Run sheet: `docs/release-evidence/wave9-executive-run-sheet.json`  
In-app recorder: **Audit** or **Reports** → Pilot / UAT panel → **Executive Sponsor recorder** (no new top-level nav)

---

## Human-gates context

| Gate | Topic | Status |
|------|-------|--------|
| **HG-01** | Business UAT (HA-PO / HA-QA) | **Deferred by request** — remains `PendingHumanSignOff`; pack ready under [wave9-uat-execution-guide.md](../uat/wave9-uat-execution-guide.md). |
| **HG-02** | Training Completion | **Prepared** — remains `PendingHumanSignOff` until humans finish ([wave9-training-execution-guide.md](../training/wave9-training-execution-guide.md)). |
| **HG-03** | Financial Reconciliation | **Prepared** — remains `PendingHumanSignOff` until humans finish ([wave9-financial-recon-execution-guide.md](../reconciliation/wave9-financial-recon-execution-guide.md)). |
| **HG-04** | Security Acceptance (HA-SEC) | **Prepared** — remains `PendingHumanSignOff` until humans finish ([wave9-security-acceptance-execution-guide.md](../security/wave9-security-acceptance-execution-guide.md)). |
| **HG-05** | Executive Sponsor Approval | **Current focus** — execute this guide |

**Honest dependency rule:** HG-01…04 may still be `PendingHumanSignOff`. The executive pack **must show** that dependency status. **Full Go** is allowed only when prerequisites are met **or** the sponsor explicitly chooses **accept with open conditions** and types the condition list (still requires typed name + confirmation phrase). **Conditional Go** is the normal path while gates remain open. **No-Go** stops Wave 10 entry.

---

## 1. How to start executive review today

1. Open the app (local / pilot web after `npm run prepare:web` if needed — **not** production).
2. **Log in as JOHN** (System Owner / executive briefing facilitator).  
   - **Executive Sponsor** records the go/no-go decision (HA-EXEC / HA-W9-EXEC).  
   - **KBA** is developer support only — call KBA only if a platform defect blocks the briefing UI.  
   - **JOHN must never see or manage the KBA account** (owner/developer isolation).
3. Open **Audit** (or **Reports**).
4. Scroll to **Pilot / UAT / Ops Readiness (Wave 9)** → **Executive Sponsor recorder (human)**.
5. Optionally click **Reload pilot evidence**, then **Sync prerequisite status** (reads local HG-01…04 run sheets if present; never fabricates Approved).
6. Walk the **review pack** below (RC1, Conditional Go meaning, deferred UAT, training / recon / security).
7. Choose **Full Go**, **Conditional Go**, or **No-Go** → type open conditions when required → type full name + phrase → **Record executive decision**.  
   - Saving memo drafts does **not** approve HA-EXEC.  
   - Recording never authorizes Wave 10 cutover or CERT-001.  
   - Use **Export for sign-off** to download JSON evidence.

**Hard constraints (entire gate):** no production deploy · no prod Supabase changes/migrations · no production config or financial data changes · preserve JOHN/KBA isolation · `SUPER_ADMIN_FORBIDDEN` · money **15 / 31 / 1000** (pesewas) · no fake Approvals.

---

## 2. What the Executive Sponsor reviews

| Topic | What to confirm | Where |
|-------|-----------------|-------|
| **RC1** | RC1 entry criterion PASS for Wave 9 framework entry | `docs/release-evidence/rc1-evidence.json` · Go/No-Go summary |
| **Conditional Go meaning** | Framework Conditional / Ready for Executive Review ≠ live cutover | [wave9-go-nogo-report.md](../wave9-go-nogo-report.md) |
| **Deferred UAT (HG-01)** | Business UAT deferred by request; HA-PO / HA-QA still PendingHumanSignOff | [wave9-uat-execution-guide.md](../uat/wave9-uat-execution-guide.md) |
| **Training (HG-02)** | Pack prepared; completion PendingHumanSignOff until humans finish | Training recorder + training run sheet |
| **Financial recon (HG-03)** | Pack prepared; HA-RECON / HA-FIN PendingHumanSignOff; `productionReconciled` remains false | Recon recorder + recon run sheet |
| **Security (HG-04)** | Pack prepared; HA-SEC PendingHumanSignOff; `productionHardenedClaim` remains false | Security recorder + security run sheet |
| **Money / isolation** | 15 / 31 / 1000 pesewas; JOHN/KBA isolation; SUPER_ADMIN_FORBIDDEN | Hard constraints on run sheet |
| **Wave 10 boundary** | After HG-05 path, cutover still blocked until real human approvals | [wave10-production-golive.md](../wave10-production-golive.md) |

---

## 3. Go / No-Go options

| Decision | When to use | Requirements |
|----------|-------------|--------------|
| **Full Go** | Sponsor authorizes Wave 9 executive acceptance toward Wave 10 **entry planning** (not cutover itself) | Typed name + `I CONFIRM EXECUTIVE SPONSOR DECISION`. If HG-01…04 all Approved → allowed. If any still PendingHumanSignOff → **blocked** unless **Accept open conditions** is checked **and** a non-empty condition list is typed. |
| **Conditional Go** | Normal path while UAT/training/recon/security remain open | Typed name + phrase + **non-empty open conditions** list. Does not claim Full Go. |
| **No-Go** | Sponsor rejects Wave 9 executive acceptance / Wave 10 entry | Typed name + phrase + **rationale** required. Does not set HA-EXEC to Approved. |

**Never:** auto-approve from Conditional Go draft evidence · claim live branch cutover · set CERT-001 certified · deploy production from this gate.

---

## 4. Roles — who signs what

| Who | Role in executive review |
|-----|--------------------------|
| JOHN | Facilitator oversight / System Owner; may prepare briefing memo; never auto-approves gates |
| Executive Sponsor | Primary **HA-EXEC** / **HA-W9-EXEC** signer — Full Go / Conditional Go / No-Go |
| Product Owner / QA | Brief on deferred HG-01 status (do not fake UAT approval) |
| Training / Finance / Security leads | Brief on HG-02…04 PendingHumanSignOff status |
| KBA | Developer support only — hidden from JOHN |

**What the Executive Sponsor signs:**  
That they **reviewed** the Wave 9 pilot pack (RC1 + Conditional Go meaning + open human gates) and recorded a **dated decision**. This is **not** Wave 10 production Accepted and **not** CERT-001 certification.

---

## 5. Memo template fields

Use these fields in the recorder (or offline memo attached to the export):

| Field | Purpose |
|-------|---------|
| Pilot name | NORTHRISE MICRO SAVINGS (confirm) |
| Review date | ISO date of executive session |
| RC1 summary | One-line RC1 PASS / exceptions |
| Deferred UAT acknowledgment | Explicit note that HG-01 remains open or waived with conditions |
| Training / recon / security status notes | Honest PendingHumanSignOff or Approved status |
| Conditions list | Bullet/line list of open conditions (required for Conditional Go; required for Full Go with open prereqs) |
| Recommendation | Full Go / Conditional Go / No-Go (must match recorded decision) |
| Risks or waivers | Named risks, owners, dates |
| Wave 10 entry intent | Planning-only vs blocked — cutover still requires Wave 10 human path |
| Decision rationale | Required for No-Go; recommended always |
| Signer full name | Typed — never blank |
| Confirmation phrase | Exact: `I CONFIRM EXECUTIVE SPONSOR DECISION` |

---

## 6. How to record evidence

1. In the **Executive Sponsor recorder**, review prerequisite status (use **Sync prerequisite status** if local HG packs were used in this browser).
2. Optionally fill memo draft fields → they do **not** flip HA-EXEC.
3. Click **Export for sign-off** → save JSON with the pilot evidence packet.
4. Executive Sponsor selects decision and uses **Record executive decision** with:
   - Typed full name  
   - Exact phrase: `I CONFIRM EXECUTIVE SPONSOR DECISION`  
   - Open conditions when Conditional Go, or Full Go with open HG-01…04  
   - Rationale when No-Go
5. Humans then update `docs/release-evidence/wave9-pilot-evidence.json` `humanApprovals` for HA-EXEC (and carry-forward HA-W9-EXEC when applicable) with the **same** names/dates (never agent-fabricated).
6. Leave `claim.wave10CutoverAuthorized` and CERT-001 **false** — Wave 10 cutover remains a separate human path.

---

## 7. After HG-05 (human path prepared)

1. All HG-01…05 **packs** are prepared for human execution.
2. **Humans must actually sign** each gate (or formally accept open conditions on HG-05) — agents/automation must not flip `PendingHumanSignOff` → `Approved`.
3. Continue the HG-05 checklist in `docs/backlog/human-gates-runbook.md`.
4. **Wave 10 cutover remains blocked** until HA-* approvals are real and Wave 10 runbooks (`docs/wave10-production-golive.md`) are executed with evidence — do not mark Wave 10 Accepted / CERT-001 certified from HG-05 pack preparation alone.

---

## 8. Related docs

- [wave9-uat-execution-guide.md](../uat/wave9-uat-execution-guide.md) (HG-01 deferred)
- [wave9-training-execution-guide.md](../training/wave9-training-execution-guide.md) (HG-02 prepared / pending)
- [wave9-financial-recon-execution-guide.md](../reconciliation/wave9-financial-recon-execution-guide.md) (HG-03 prepared / pending)
- [wave9-security-acceptance-execution-guide.md](../security/wave9-security-acceptance-execution-guide.md) (HG-04 prepared / pending)
- [wave9-go-nogo-report.md](../wave9-go-nogo-report.md)
- [human-gates-runbook.md](../backlog/human-gates-runbook.md)
- [critical-path-report.md](../backlog/critical-path-report.md)
- [wave10-production-golive.md](../wave10-production-golive.md)
- Run sheet: [wave9-executive-run-sheet.json](../release-evidence/wave9-executive-run-sheet.json)

*Wave 9 executive sponsor execution guide — prepared for human pilot execution; no fake Full Go / HA-EXEC approval; Wave 10 cutover still blocked until real approvals.*
