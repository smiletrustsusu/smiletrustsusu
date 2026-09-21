/**
 * Org-blocked hard stops for Audit/Reports (read-only).
 * Does not flip HA-* gates, invent certs, or claim cutover complete.
 */

/** @typedef {{ id: string, owner: string, action: string, gap?: string }} OrgBlockedItem */

/** @type {ReadonlyArray<OrgBlockedItem>} */
export const ORG_BLOCKED_HARD_STOPS = Object.freeze([
  Object.freeze({
    id: "HA-GATES",
    gap: "GAP-003",
    owner: "Executive Sponsor / Release Manager / domain owners",
    action: "Sign Wave 9 HA-* gates (HG-05 current; HG-01 deferred). Never auto-Approve."
  }),
  Object.freeze({
    id: "CUTOVER",
    gap: "GAP-001",
    owner: "Release Manager + CO-* owners",
    action: "Execute live CO-01…CO-13 after HA-* Approvals; local wave10:cutover-record is rehearsal only."
  }),
  Object.freeze({
    id: "CERT-001",
    gap: "GAP-002",
    owner: "Accountable Authority + Executive Sponsor",
    action: "Human AA sign-off after live cutover evidence — CERT-001 stays preview until then."
  }),
  Object.freeze({
    id: "ANDROID-SIGN",
    gap: "GAP-004",
    owner: "Platform Administrator",
    action: "Provide org Android release keystore + SMILE_ANDROID_* secrets (do not invent)."
  }),
  Object.freeze({
    id: "ELECTRON-SIGN",
    gap: "GAP-008",
    owner: "Platform Administrator",
    action: "Provide CSC_* cert + real SMILE_UPDATE_FEED_URL; then enable signAndEditExecutable."
  }),
  Object.freeze({
    id: "CI-REMOTE",
    gap: "GAP-007",
    owner: "Platform Administrator",
    action: "Connect org VCS remote and obtain a green Actions CI run."
  }),
  Object.freeze({
    id: "MONEY-SQL",
    gap: "GAP-005",
    owner: "CIO",
    action: "Lift migration freeze only with CIO plan — no float→pesewas SQL rewrite without approval."
  }),
  Object.freeze({
    id: "UAT-MIG",
    gap: "GAP-010",
    owner: "DBA / Release Manager",
    action: "Apply migrations through 045 on UAT Supabase only (not prod from agent scripts)."
  })
]);

/**
 * Snapshot for UI / docs. Never marks items Approved.
 * @returns {{ schemaVersion: string, blockedCount: number, items: OrgBlockedItem[], note: string }}
 */
export function listOrgBlockedHardStops() {
  return {
    schemaVersion: "smile-trust-org-blocked/1.0",
    blockedCount: ORG_BLOCKED_HARD_STOPS.length,
    items: ORG_BLOCKED_HARD_STOPS.slice(),
    note: "Implementation paused for these rows pending org/humans. See docs/backlog/blocked-on-org.md."
  };
}
