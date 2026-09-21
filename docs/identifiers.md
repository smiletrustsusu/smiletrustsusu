# Global identifier standard

Smile Trust keeps existing live ids (`uid("col")`, printed receipts, `u-owner`). This module defines one catalog so sync, audit, and future APIs do not invent a second scheme.

| Kind | Owner | Notes |
|---|---|---|
| Technical ID | Owning module | UUID v7 preferred; legacy `prefix-…` values stay valid |
| Business ID | Prefix catalog (`CUS`, `COL`, `RCP`, …) | Optional `PREFIX-BRANCH-YEAR-SEQUENCE`; current receipts `RCP-00000001` still valid |
| Correlation ID | Workflow | Groups a business process; does not replace entity ids |
| Idempotency key | Client (delegated) | Already used on collections |
| Aggregate ID + version | Entity | Primary aggregate drives sequential sync |
| External reference | External system | MoMo / SMS ids stored separately, never rewritten |
| Temporary receipt | Receipt service, delegated to Android | Maps to permanent `SRV-…` after sync; printed number does not change |

Permanent journal numbers, audit ids, and server receipt numbers are not generated offline. New identifier delegations need maker-checker approval; the seeded offline-receipt and idempotency delegations are already active so field collection does not stop.
