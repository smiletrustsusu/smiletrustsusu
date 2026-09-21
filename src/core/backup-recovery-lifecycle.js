/**
 * Module 21 — Backup, restore, disaster recovery, and continuity lifecycle.
 */

export const BACKUP_TYPES = [
  "full",
  "incremental",
  "differential",
  "transaction_log",
  "snapshot",
  "application",
  "file",
  "android_offline"
];

export const BACKUP_STATES = ["created", "running", "completed", "verified", "failed", "expired"];

export const RESTORE_STATES = [
  "requested",
  "authorized",
  "approved",
  "validated",
  "executing",
  "verified",
  "reconciled",
  "activated",
  "rejected",
  "failed"
];

export const RESTORE_TRANSITION_MATRIX = {
  requested: ["authorized", "rejected"],
  authorized: ["approved", "rejected"],
  approved: ["validated", "rejected"],
  validated: ["executing", "failed"],
  executing: ["verified", "failed"],
  verified: ["reconciled", "failed"],
  reconciled: ["activated"],
  activated: [],
  rejected: [],
  failed: ["requested"]
};

export const DR_STRATEGIES = ["cold", "warm", "hot"];
export const DR_ROLES = ["primary", "secondary"];

export const CONTINUITY_DOMAINS = [
  "payment",
  "savings_collection",
  "loan_servicing",
  "accounting",
  "android_offline",
  "synchronization",
  "customer_service",
  "branch_operations"
];

export const DEFAULT_RETENTION = {
  daily: 30,
  weekly: 12,
  monthly: 24,
  annual: 7,
  audit: 2555,
  transactionLog: 90
};

export const DEFAULT_RECOVERY_OBJECTIVES = {
  rtoMinutes: 240,
  rpoMinutes: 60
};

export function canTransitionRestore(from, to) {
  return (RESTORE_TRANSITION_MATRIX[from] || []).includes(to);
}

export function backupScopeKeys(type) {
  if (type === "application") return ["parameterValues", "featureFlags", "reportTemplates", "documentTemplates"];
  if (type === "file") return ["documents", "documentQrCodes", "documentSignatures"];
  if (type === "android_offline") return ["offlineQueue", "offlineMonitoringQueue", "offlineConfiguration", "localReceipts"];
  if (type === "incremental" || type === "differential") return ["collections", "audit", "paymentTransactions"];
  return ["collections", "customers", "loans", "audit", "journalEntries", "settings"];
}

export function rpoBreach(lastBackupAt, rpoMinutes, now) {
  if (!lastBackupAt) return true;
  const age = (Number(now) - Date.parse(lastBackupAt)) / 60000;
  return age > Number(rpoMinutes || DEFAULT_RECOVERY_OBJECTIVES.rpoMinutes);
}

export function rtoCompliant(durationMinutes, rtoMinutes) {
  return Number(durationMinutes) <= Number(rtoMinutes || DEFAULT_RECOVERY_OBJECTIVES.rtoMinutes);
}
