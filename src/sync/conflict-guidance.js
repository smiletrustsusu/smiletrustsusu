/**
 * Wave 4 — Conflict detection guidance for collectors / supervisors.
 * Financial kinds never last-write-wins / client-wins (Module 15 + Phase 18).
 */

import { isFinancialKind, CONFLICT_STRATEGIES } from "../core/sync-ops.js";
import { evaluateDecisionFlow } from "../core/phase18-ops-sla.js";

const REASON_GUIDANCE = Object.freeze({
  revoked_device: {
    severity: "critical",
    summary: "This device was revoked and cannot sync.",
    collectorAction: "Stop collecting on this phone. Contact Operations (SRT-008).",
    resolverAction: "Confirm revoke; authorize a replacement device; transfer recoverable queue."
  },
  deleted_record: {
    severity: "high",
    summary: "Target customer or account is closed or missing.",
    collectorAction: "Do not re-enter the same amount. Escalate to Branch Supervisor.",
    resolverAction: "Verify member status; cancel or rematerialize under business rule."
  },
  unknown_aggregate: {
    severity: "high",
    summary: "Primary aggregate is unknown on the server.",
    collectorAction: "Keep the printed receipt; escalate with receipt number.",
    resolverAction: "Match temporary receipt; create missing aggregate or cancel duplicate."
  },
  duplicate_customer: {
    severity: "medium",
    summary: "Another customer already uses this phone.",
    collectorAction: "Do not create a second profile. Ask supervisor to merge.",
    resolverAction: "Merge or reject offline registration; preserve audit trail."
  },
  version_mismatch: {
    severity: "high",
    summary: "Server version differs from the device expectation.",
    collectorAction: "Wait for Sync.Resolve. Do not force overwrite money.",
    resolverAction: "Apply business_rule; never client_wins for financial kinds."
  },
  circular_dependency: {
    severity: "high",
    summary: "Hard dependency cycle blocks ordered sync.",
    collectorAction: "Report queue item ids to Operations.",
    resolverAction: "Break cycle; re-queue dependents after root apply."
  },
  missing_hard_dependency: {
    severity: "medium",
    summary: "A required dependency is not applied yet.",
    collectorAction: "Keep collecting unrelated customers; retry later.",
    resolverAction: "Ensure dependency applies first; then retry."
  },
  duplicate_collection: {
    severity: "critical",
    summary: "Same idempotency key already applied with a different payload.",
    collectorAction: "Do not collect again. Show printed receipt to supervisor.",
    resolverAction: "Mark as applied/cancel under business_rule; never double-post."
  }
});

export function guidanceForReasons(reasons = []) {
  const list = [...new Set((reasons || []).map(String))];
  return list.map((reason) => ({
    reason,
    ...(REASON_GUIDANCE[reason] || {
      severity: "medium",
      summary: "Sync conflict requires review.",
      collectorAction: "Pause this item; continue unrelated work; escalate if unsure.",
      resolverAction: "Use Sync.Resolve with business_rule; never LWW for money."
    })
  }));
}

export function allowedStrategiesForConflict(conflict = {}, entry = {}) {
  const financial = isFinancialKind(entry.kind || conflict.kind);
  const all = [...CONFLICT_STRATEGIES];
  if (financial) {
    return all.filter((s) => s !== "client_wins" && s !== "merge");
  }
  return all;
}

export function buildConflictGuidance(conflict = {}, entry = {}) {
  const reasons = conflict.reasons || [];
  const financial = isFinancialKind(entry.kind || conflict.kind);
  const decision = evaluateDecisionFlow({
    flow: "conflict",
    conflict: true,
    financial
  });
  const strategies = allowedStrategiesForConflict(conflict, entry);
  return {
    ok: true,
    conflictId: conflict.id || "",
    queueItemId: conflict.queueItemId || entry.id || "",
    kind: entry.kind || conflict.kind || "",
    financial,
    forbidClientWins: financial,
    forbidLastWriteWins: financial,
    recommendedStrategy: financial ? "business_rule" : (conflict.strategy || "manual"),
    allowedStrategies: strategies,
    reasons: guidanceForReasons(reasons),
    decision: decision.ok ? decision : null,
    collectorBanner: financial
      ? "Money conflict held — do not re-enter. Supervisor must resolve (no last-write-wins)."
      : "Sync conflict held — tap Retry after supervisor resolves, or continue other customers."
  };
}

export function conflictGuidanceRows(state = {}) {
  const open = (state.syncConflicts || []).filter((c) => c.status === "open");
  return open.map((conflict) => {
    const entry = (state.offlineQueue || []).find((item) => item.id === conflict.queueItemId) || {};
    return buildConflictGuidance(conflict, entry);
  });
}
