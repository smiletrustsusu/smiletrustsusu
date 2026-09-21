import { handoverExceptions } from "./handover.js";

export function recordException(state, {
  id,
  type,
  severity = "warn",
  referenceId = "",
  referenceType = "",
  collectorId = "",
  reason
}) {
  state.exceptions = state.exceptions || [];
  const entry = {
    id,
    type,
    severity,
    referenceId,
    referenceType,
    collectorId,
    reason: String(reason || "").trim(),
    resolved: false,
    createdAt: new Date().toISOString()
  };
  state.exceptions.push(entry);
  return entry;
}

export function buildExceptionReport(state, helpers = {}) {
  const {
    today = () => new Date().toISOString().slice(0, 10),
    pendingVerifications = [],
    arrearsCount = 0,
    pendingReversals = [],
    handovers = [],
    unsubmittedCollectors = []
  } = helpers;

  const report = [];

  pendingVerifications.forEach((item) => {
    report.push({
      type: "pending_verification",
      severity: "warn",
      detail: `${item.customerName || item.customerId} · ${item.amount}`,
      date: item.date
    });
  });

  pendingReversals.forEach((item) => {
    report.push({
      type: "pending_reversal",
      severity: "warn",
      detail: item.reason,
      date: item.createdAt?.slice(0, 10)
    });
  });

  if (arrearsCount > 0) {
    report.push({
      type: "customers_behind",
      severity: arrearsCount >= 5 ? "danger" : "warn",
      detail: `${arrearsCount} customer(s) behind on contributions`
    });
  }

  handovers.forEach((handover) => {
    handoverExceptions(handover).forEach((ex) => {
      report.push({
        type: ex.type,
        severity: ex.severity,
        detail: `Collector handover ${handover.date}: ${ex.type} GHS ${ex.amount?.toFixed?.(2) || ex.amount}`,
        date: handover.date
      });
    });
    if (handover.status === "Submitted" && !handover.verifiedAt) {
      report.push({
        type: "unverified_handover",
        severity: "warn",
        detail: `Handover submitted but not verified for ${handover.date}`,
        date: handover.date
      });
    }
  });

  unsubmittedCollectors.forEach((name) => {
    report.push({
      type: "missing_handover",
      severity: "danger",
      detail: `${name} has not submitted handover for ${today()}`
    });
  });

  return report.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}
