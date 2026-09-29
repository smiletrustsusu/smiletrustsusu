/**
 * Daily collector handover / remittance workflow.
 * Collector submits cash to a chosen responsible receiver (Manager / Ops / Accountant / Cashier);
 * that person confirms receipt at their end.
 */

export const HANDOVER_RECEIVER_ROLES = Object.freeze([
  "SystemOwner",
  "KBA",
  "ManagingDirector",
  "Admin",
  "OperationsManager",
  "Accountant",
  "Cashier"
]);

export function isHandoverReceiverRole(role) {
  return HANDOVER_RECEIVER_ROLES.includes(String(role || ""));
}

/**
 * Active staff who can receive physical cash handovers.
 * Prefers same-branch staff when groupId is known, then HQ/finance roles.
 */
export function listHandoverReceivers(users = [], { excludeUserId = "", groupId = "" } = {}) {
  const active = (users || []).filter((user) =>
    user
    && user.active !== false
    && user.id !== excludeUserId
    && isHandoverReceiverRole(user.role)
  );
  const branchMatched = groupId
    ? active.filter((user) => !user.groupId || user.groupId === groupId)
    : active;
  const list = branchMatched.length ? branchMatched : active;
  return list.slice().sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

export function pendingHandoversForReceiver(handovers = [], receiverId = "") {
  if (!receiverId) return [];
  return (handovers || []).filter((item) =>
    item
    && item.receiverId === receiverId
    && item.status === "Submitted"
  );
}

export function expectedCashForCollector(state, collectorId, date, helpers = {}) {
  const {
    collections = [],
    verificationStatus = (item) => item.verificationStatus || ((item.paymentMethod || "Cash") === "Cash" ? "Verified" : "Pending Verification")
  } = helpers;
  return collections
    .filter((item) =>
      item.userId === collectorId
      && item.date === date
      && Number(item.amount || 0) > 0
      && !item.reversed
      && (item.paymentMethod || "Cash") === "Cash"
      && verificationStatus(item) === "Verified"
    )
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

export function channelTotalsForCollector(state, collectorId, date, helpers = {}) {
  const { collections = [] } = helpers;
  const totals = { Cash: 0, "Mobile Money": 0, "Bank Transfer": 0, "POS/Card": 0 };
  collections
    .filter((item) => item.userId === collectorId && item.date === date && !item.reversed)
    .forEach((item) => {
      const method = item.paymentMethod || "Cash";
      totals[method] = (totals[method] || 0) + Number(item.amount || 0);
    });
  return totals;
}

export function buildHandoverRecord(state, {
  id,
  collectorId,
  groupId,
  date,
  declaredCash,
  note = "",
  userId,
  receiverId = "",
  receiverName = ""
}) {
  const channels = channelTotalsForCollector(state, collectorId, date, {
    collections: state.collections || []
  });
  const expected = expectedCashForCollector(state, collectorId, date, {
    collections: state.collections || [],
    verificationStatus: (item) => item.verificationStatus || (item.paymentMethod === "Cash" ? "Verified" : "Pending Verification")
  });
  return {
    id,
    collectorId,
    groupId,
    date,
    expectedCash: expected,
    declaredCash: Number(declaredCash || 0),
    countedCash: null,
    momoTotal: channels["Mobile Money"] || 0,
    bankTotal: channels["Bank Transfer"] || 0,
    posTotal: channels["POS/Card"] || 0,
    cashTotal: channels.Cash || 0,
    receiverId: String(receiverId || "").trim(),
    receiverName: String(receiverName || "").trim(),
    status: "Submitted",
    submittedAt: new Date().toISOString(),
    verifiedAt: "",
    verifiedBy: "",
    shortageReason: "",
    note,
    userId,
    createdAt: new Date().toISOString()
  };
}

export function verifyHandover(handover, { countedCash, verifiedBy, shortageReason = "" }) {
  handover.countedCash = Number(countedCash || 0);
  handover.verifiedBy = verifiedBy;
  handover.verifiedAt = new Date().toISOString();
  handover.shortageReason = String(shortageReason || "").trim();
  handover.status = "Received";
  handover.difference = handover.countedCash - Number(handover.expectedCash || 0);
  handover.declaredDifference = handover.declaredCash - Number(handover.expectedCash || 0);
  return handover;
}

export function handoverStatusLabel(status) {
  if (status === "Received" || status === "Verified") return "Received";
  if (status === "Submitted") return "Awaiting confirmation";
  return String(status || "");
}

export function handoverIsConfirmed(handover) {
  return handover?.status === "Received" || handover?.status === "Verified";
}

export function handoverExceptions(handover) {
  const items = [];
  const expected = Number(handover.expectedCash || 0);
  const declared = Number(handover.declaredCash || 0);
  const counted = Number(handover.countedCash ?? declared);
  if (declared < expected) {
    items.push({ type: "shortage_declared", amount: expected - declared, severity: "danger" });
  }
  if (counted < expected) {
    items.push({ type: "shortage_counted", amount: expected - counted, severity: "danger" });
  }
  if (counted > expected) {
    items.push({ type: "surplus_counted", amount: counted - expected, severity: "warn" });
  }
  if (declared !== counted) {
    items.push({ type: "declared_vs_counted", amount: Math.abs(declared - counted), severity: "warn" });
  }
  return items;
}
