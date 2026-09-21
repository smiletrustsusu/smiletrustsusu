/**
 * Module 25 — data exchange job, format, and classification lifecycle.
 * Does not post collections or change financial engines.
 */

export const EXCHANGE_SCHEMA_LIFECYCLE = "1.0.0";

export const EXCHANGE_JOB_STATES = [
  "draft",
  "validating",
  "pending_approval",
  "queued",
  "running",
  "paused",
  "completed",
  "failed",
  "cancelled",
  "rolled_back"
];

export const EXCHANGE_TRANSITIONS = {
  draft: ["validating", "cancelled"],
  validating: ["pending_approval", "queued", "failed", "cancelled"],
  pending_approval: ["queued", "cancelled", "failed"],
  queued: ["running", "cancelled", "paused"],
  running: ["paused", "completed", "failed", "cancelled"],
  paused: ["running", "cancelled"],
  completed: ["rolled_back"],
  failed: ["queued", "cancelled"],
  cancelled: [],
  rolled_back: []
};

export const IMPORT_TYPES = [
  "customers", "branches", "agents", "savings_accounts", "savings_transactions",
  "loan_accounts", "loan_repayments", "withdrawals", "accounting_charts",
  "journal_entries", "documents_metadata", "configuration", "workflow_definitions",
  "rule_definitions", "payment_provider_configuration"
];

export const EXPORT_TYPES = [
  "customers", "savings_statements", "loan_statements", "financial_reports",
  "audit_reports", "workflow_history", "security_reports", "backup_metadata",
  "business_intelligence", "regulatory_reports", "configuration"
];

export const EXCHANGE_FORMATS = ["csv", "xlsx", "json", "xml", "pdf", "zip"];

export const DATA_CLASSIFICATIONS = ["Public", "Internal", "Confidential", "Financial", "Restricted"];

export function canTransitionExchange(from, to) {
  return (EXCHANGE_TRANSITIONS[from] || []).includes(to);
}

export function assertExchangeLifecycleBoundary() {
  return {
    documentedOnly: true,
    postsCollections: false,
    restHttp: false,
    graphqlHttp: false
  };
}
