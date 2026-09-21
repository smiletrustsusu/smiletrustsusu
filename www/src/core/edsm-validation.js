/**
 * EDSM sample compliance helpers.
 * Thin validators over canonical-standards-registry — no engine rewrite.
 */

import {
  MONEY_INVARIANTS,
  AUTHORITATIVE_STACK,
  REJECTED_PRIMARY_STACKS,
  ROLE_ALIASES,
  getStandard,
  listComplianceChecks,
  validateStandardsRegistry,
  edsmCounts
} from "./canonical-standards-registry.js";

function ok(extra = {}) {
  return { ok: true, ...extra };
}

function fail(code, message, extra = {}) {
  return { ok: false, severity: "critical", code, message, ...extra };
}

/**
 * Validate a sample change description / metadata object for EDSM alignment.
 * @param {object} sample
 * @param {string} [sample.deliveryStack] - e.g. "vanilla-js-spa" | "capacitor-shared-spa"
 * @param {boolean} [sample.usesInvokeApi]
 * @param {boolean} [sample.introducesNextJs]
 * @param {boolean} [sample.introducesComposePrimary]
 * @param {boolean} [sample.newTopLevelNav]
 * @param {boolean} [sample.aiAutoApprovesLoans]
 * @param {object} [sample.money]
 */
export function validateSampleCompliance(sample = {}) {
  const findings = [];

  if (sample.introducesNextJs === true) {
    findings.push(
      fail("EDSM-SAMP-001", "Next.js must not be introduced as primary delivery", {
        rejected: REJECTED_PRIMARY_STACKS
      })
    );
  }
  if (sample.introducesComposePrimary === true) {
    findings.push(
      fail("EDSM-SAMP-002", "Jetpack Compose must not be primary Android UI", {
        rejected: REJECTED_PRIMARY_STACKS
      })
    );
  }
  if (sample.newTopLevelNav === true) {
    findings.push(fail("EDSM-SAMP-003", "New top-level nav is forbidden"));
  }
  if (sample.aiAutoApprovesLoans === true) {
    findings.push(fail("EDSM-SAMP-004", "AI must remain advisory only"));
  }

  if (sample.usesInvokeApi === false) {
    findings.push(
      fail("EDSM-SAMP-005", "Domain mutations should use invokeApi", {
        authoritativeApi: AUTHORITATIVE_STACK.api
      })
    );
  }

  if (sample.deliveryStack) {
    const allowed = new Set([
      AUTHORITATIVE_STACK.web,
      AUTHORITATIVE_STACK.android,
      AUTHORITATIVE_STACK.windows,
      "shared-spa",
      "electron-www"
    ]);
    if (!allowed.has(sample.deliveryStack)) {
      findings.push(
        fail("EDSM-SAMP-006", `Unknown or rejected deliveryStack: ${sample.deliveryStack}`, {
          allowed: [...allowed]
        })
      );
    }
  }

  if (sample.money && typeof sample.money === "object") {
    const m = sample.money;
    if (m.unit != null && m.unit !== MONEY_INVARIANTS.unit) {
      findings.push(fail("EDSM-SAMP-007", "Money unit must be pesewas", { got: m.unit }));
    }
    if (m.interestDefault != null && m.interestDefault !== MONEY_INVARIANTS.interestDefault) {
      findings.push(
        fail("EDSM-SAMP-008", "Interest default must be 15 unless audited config", {
          got: m.interestDefault
        })
      );
    }
    if (m.collectionDays != null && m.collectionDays !== MONEY_INVARIANTS.collectionDays) {
      findings.push(
        fail("EDSM-SAMP-009", "Collection days must be 31", { got: m.collectionDays })
      );
    }
    if (m.cashierLimitGhs != null && m.cashierLimitGhs !== MONEY_INVARIANTS.cashierLimitGhs) {
      findings.push(
        fail("EDSM-SAMP-010", "Cashier limit must be 1000", { got: m.cashierLimitGhs })
      );
    }
  }

  const critical = findings.filter((f) => f.severity === "critical");
  return {
    ok: critical.length === 0,
    critical: critical.length,
    findings,
    roleAliases: ROLE_ALIASES,
    moneyInvariants: MONEY_INVARIANTS
  };
}

/**
 * Build a compliance-check result object suitable for schema examples.
 */
export function buildComplianceCheckResult({
  checkId = "CHK-001",
  status = "pass",
  evidence = [],
  reviewer = "QA Lead"
} = {}) {
  const check = getStandard(checkId) || listComplianceChecks().find((c) => c.id === checkId);
  return {
    id: checkId,
    code: check?.code || "CHK_UNKNOWN",
    status,
    critical: check?.critical !== false,
    evidence,
    reviewer,
    evaluatedAt: new Date().toISOString(),
    moneyInvariantNote: MONEY_INVARIANTS.note,
    stackNote:
      "Android=Capacitor+shared SPA; Web=vanilla JS SPA; Next.js/Compose not primary"
  };
}

export function validateEdsmPackage() {
  const registry = validateStandardsRegistry();
  const samplePass = validateSampleCompliance({
    deliveryStack: "vanilla-js-spa",
    usesInvokeApi: true,
    introducesNextJs: false,
    introducesComposePrimary: false,
    newTopLevelNav: false,
    aiAutoApprovesLoans: false,
    money: {
      unit: "pesewas",
      interestDefault: 15,
      collectionDays: 31,
      cashierLimitGhs: 1000
    }
  });
  const sampleFailNext = validateSampleCompliance({ introducesNextJs: true });
  const sampleFailCompose = validateSampleCompliance({ introducesComposePrimary: true });

  const critical =
    (registry.critical || 0) +
    (samplePass.critical || 0) +
    (sampleFailNext.ok ? 1 : 0) +
    (sampleFailCompose.ok ? 1 : 0);

  // sampleFail* must NOT be ok
  const failProbeCritical =
    sampleFailNext.ok || sampleFailCompose.ok
      ? [{ severity: "critical", code: "EDSM-PKG-001", message: "Reject probes unexpectedly passed" }]
      : [];

  return {
    ok: registry.ok && samplePass.ok && !sampleFailNext.ok && !sampleFailCompose.ok,
    critical: registry.critical + samplePass.critical + failProbeCritical.length,
    registry,
    samplePass,
    sampleFailNext,
    sampleFailCompose,
    counts: edsmCounts()
  };
}

export { MONEY_INVARIANTS, AUTHORITATIVE_STACK, REJECTED_PRIMARY_STACKS };
