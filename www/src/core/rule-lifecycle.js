/**
 * Module 24 — rule, decision, and scoring lifecycle.
 * Configurable evaluation only. Does not post collections or change financial engines.
 */

export const RULE_SCHEMA_LIFECYCLE = "1.0.0";

export const RULE_TYPES = [
  "validation",
  "decision",
  "calculation",
  "eligibility",
  "risk",
  "routing",
  "policy",
  "scoring"
];

export const RULE_STATES = ["draft", "testing", "approval", "published", "deprecated", "retired"];

export const RULE_TRANSITION_MATRIX = {
  draft: ["testing", "retired"],
  testing: ["draft", "approval", "retired"],
  approval: ["draft", "published", "retired"],
  published: ["deprecated", "retired"],
  deprecated: ["retired", "published"],
  retired: []
};

export const HIT_POLICIES = ["first", "unique", "collect", "any", "priority"];

export const DECISION_OUTCOMES = ["Approve", "Reject", "Escalate", "Manual Review", "Retry", "Hold"];

export const EXECUTION_MODES = ["synchronous", "asynchronous", "batch", "scheduled", "event"];

export function canTransitionRule(from, to) {
  return (RULE_TRANSITION_MATRIX[from] || []).includes(to);
}

export function isPublishedRule(status) {
  return status === "published";
}

export function isTerminalRule(status) {
  return status === "retired";
}

export function assertRuleLifecycleBoundary() {
  return {
    documentedOnly: true,
    postsCollections: false,
    restHttp: false,
    graphqlHttp: false,
    sideEffectFree: true
  };
}
