/**
 * Master Implementation Backlog — 20 implementation-order waves.
 * Traces to Phase 20 EIBPRFBS; does not redefine Phases 1–20 or Modules 1–30.
 * Money invariants: pesewas · interest 15 · collection days 31 · cashier 1000.
 */

export const MIB_WAVES_VERSION = "1.0.0";

/** @typedef {{ wave: number, code: string, title: string, priority: string, primaryModules: number[], primaryPhases: number[], owner: string, team: string }} WaveDef */

/** @type {ReadonlyArray<WaveDef>} */
export const IMPLEMENTATION_WAVES = Object.freeze([
  Object.freeze({ wave: 1, code: "FOUNDATION", title: "Foundation", priority: "Critical", primaryModules: [14, 30], primaryPhases: [1, 2, 10], owner: "Platform Administrator", team: "Platform" }),
  Object.freeze({ wave: 2, code: "AUTH_RBAC", title: "Auth & RBAC", priority: "Critical", primaryModules: [1], primaryPhases: [1, 9], owner: "Security Governance Lead", team: "Security" }),
  Object.freeze({ wave: 3, code: "TENANT_BRANCH", title: "Tenant & Branch", priority: "Critical", primaryModules: [5, 30], primaryPhases: [3, 8], owner: "Platform Administrator", team: "Platform" }),
  Object.freeze({ wave: 4, code: "DATABASE", title: "Database", priority: "Critical", primaryModules: [14, 30], primaryPhases: [7], owner: "Platform Administrator", team: "Data" }),
  Object.freeze({ wave: 5, code: "CORE_APIS", title: "Core APIs", priority: "Critical", primaryModules: [20], primaryPhases: [6], owner: "CIO", team: "Integration" }),
  Object.freeze({ wave: 6, code: "SYNC_ENGINE", title: "Sync Engine", priority: "Critical", primaryModules: [15], primaryPhases: [5, 14], owner: "Platform Administrator", team: "Platform" }),
  Object.freeze({ wave: 7, code: "CUSTOMER", title: "Customer", priority: "High", primaryModules: [3], primaryPhases: [3], owner: "Platform Administrator", team: "Domain" }),
  Object.freeze({ wave: 8, code: "SAVINGS", title: "Savings", priority: "Critical", primaryModules: [6, 7], primaryPhases: [3, 4, 16], owner: "CIO", team: "Domain" }),
  Object.freeze({ wave: 9, code: "DAILY_COLLECTIONS", title: "Daily Collections", priority: "Critical", primaryModules: [4, 6], primaryPhases: [3, 16], owner: "CIO", team: "Domain" }),
  Object.freeze({ wave: 10, code: "LOANS", title: "Loans", priority: "Critical", primaryModules: [8], primaryPhases: [3, 4, 16], owner: "CIO", team: "Domain" }),
  Object.freeze({ wave: 11, code: "ACCOUNTING", title: "Accounting", priority: "Critical", primaryModules: [10], primaryPhases: [3, 7, 16], owner: "CIO", team: "Finance" }),
  Object.freeze({ wave: 12, code: "REPORTS", title: "Reports", priority: "High", primaryModules: [11, 27], primaryPhases: [13, 17], owner: "Policy Owner", team: "Analytics" }),
  Object.freeze({ wave: 13, code: "DASHBOARDS", title: "Dashboards", priority: "High", primaryModules: [2], primaryPhases: [1, 13], owner: "Platform Administrator", team: "Platform" }),
  Object.freeze({ wave: 14, code: "NOTIFICATIONS", title: "Notifications", priority: "Medium", primaryModules: [12], primaryPhases: [5, 18], owner: "Platform Administrator", team: "Platform" }),
  Object.freeze({ wave: 15, code: "MONITORING", title: "Monitoring", priority: "High", primaryModules: [19], primaryPhases: [13, 18], owner: "Platform Administrator", team: "Ops" }),
  Object.freeze({ wave: 16, code: "SECURITY", title: "Security", priority: "Critical", primaryModules: [1, 22], primaryPhases: [9, 16], owner: "Security Governance Lead", team: "Security" }),
  Object.freeze({ wave: 17, code: "AI", title: "AI", priority: "Medium", primaryModules: [29], primaryPhases: [12, 16], owner: "Compliance Officer", team: "AI" }),
  Object.freeze({ wave: 18, code: "TESTING", title: "Testing", priority: "Critical", primaryModules: [30], primaryPhases: [16], owner: "Release Manager", team: "QA" }),
  Object.freeze({ wave: 19, code: "DEPLOYMENT", title: "Deployment", priority: "Critical", primaryModules: [21, 30], primaryPhases: [14, 15], owner: "Release Manager", team: "DevOps" }),
  Object.freeze({ wave: 20, code: "PRODUCTION_READINESS", title: "Production Readiness", priority: "Critical", primaryModules: [30], primaryPhases: [19, 20], owner: "Governance Board Chair", team: "Governance" })
]);

export function getWave(waveNumber) {
  return IMPLEMENTATION_WAVES.find((w) => w.wave === waveNumber) || null;
}

export function listWaves() {
  return IMPLEMENTATION_WAVES;
}

export function waveCodeToNumber(code) {
  const w = IMPLEMENTATION_WAVES.find((x) => x.code === code);
  return w ? w.wave : null;
}
