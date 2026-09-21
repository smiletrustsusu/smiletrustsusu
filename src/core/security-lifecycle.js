/**
 * Module 22 — Security operations, fraud detection, and risk lifecycle.
 */

export const RISK_BANDS = [
  { level: "low", min: 0, max: 25 },
  { level: "medium", min: 25, max: 50 },
  { level: "high", min: 50, max: 75 },
  { level: "critical", min: 75, max: Infinity }
];

export const INCIDENT_STATES = ["open", "investigating", "contained", "closed"];
export const INCIDENT_TRANSITIONS = {
  open: ["investigating", "contained", "closed"],
  investigating: ["contained", "closed"],
  contained: ["closed", "investigating"],
  closed: []
};

export const FRAUD_STATES = ["detected", "investigating", "confirmed", "dismissed"];
export const FRAUD_TRANSITIONS = {
  detected: ["investigating", "dismissed"],
  investigating: ["confirmed", "dismissed"],
  confirmed: ["dismissed"],
  dismissed: []
};

export const THREAT_TYPES = [
  "velocity",
  "large_amount",
  "duplicate_collection",
  "failed_authentication",
  "device_revoked",
  "payment_fraud_flag",
  "sync_conflict",
  "integrity_failure",
  "rate_limit",
  "tamper"
];

export function riskLevelFromScore(score) {
  const value = Number(score) || 0;
  if (value >= 75) return "critical";
  if (value >= 50) return "high";
  if (value >= 25) return "medium";
  return "low";
}

export function canTransitionIncident(from, to) {
  return (INCIDENT_TRANSITIONS[from] || []).includes(to);
}

export function canTransitionFraud(from, to) {
  return (FRAUD_TRANSITIONS[from] || []).includes(to);
}
