/**
 * Module 26 — digital record lifecycle. Does not generate receipts or post money.
 * Module 17 remains the receipt/statement generator.
 */

export const RECORDS_SCHEMA_LIFECYCLE = "1.0.0";

export const RECORD_STATES = ["uploaded", "validated", "active", "archived", "retired", "superseded", "deleted"];

export const RECORD_TRANSITIONS = {
  uploaded: ["validated", "deleted"],
  validated: ["active", "deleted"],
  active: ["archived", "superseded", "deleted"],
  archived: ["retired", "active"],
  retired: [],
  superseded: [],
  deleted: []
};

export const RECORD_TYPES = [
  "customer_photograph",
  "national_id",
  "passport_photograph",
  "signature_image",
  "customer_agreement",
  "loan_agreement",
  "guarantor_document",
  "savings_receipt",
  "withdrawal_receipt",
  "payment_confirmation",
  "accounting_report",
  "audit_report",
  "regulatory_report",
  "workflow_attachment",
  "rule_artifact",
  "system_pdf",
  "backup_manifest",
  "compliance_evidence",
  "staff_document",
  "branch_document"
];

export const RECORD_CLASSIFICATIONS = ["Public", "Internal", "Confidential", "Financial", "Restricted"];

export const STORAGE_PROVIDERS = ["local", "network", "cloud", "hybrid"];

export function canTransitionRecord(from, to) {
  return (RECORD_TRANSITIONS[from] || []).includes(to);
}

export function classificationForType(type) {
  if (["accounting_report", "savings_receipt", "withdrawal_receipt", "payment_confirmation", "loan_agreement"].includes(type)) return "Financial";
  if (["national_id", "passport_photograph", "signature_image", "customer_photograph", "customer_agreement", "guarantor_document"].includes(type)) return "Confidential";
  if (["audit_report", "regulatory_report", "compliance_evidence", "backup_manifest"].includes(type)) return "Restricted";
  if (["staff_document", "branch_document", "workflow_attachment", "rule_artifact"].includes(type)) return "Internal";
  return "Internal";
}

export function assertRecordsLifecycleBoundary() {
  return {
    documentedOnly: true,
    postsCollections: false,
    generatesReceipts: false,
    restHttp: false,
    graphqlHttp: false
  };
}
