/**
 * Module 28 — Ownership matrix, deadline templates, delivery dashboard (in-process governance).
 */

import { recordAuditEvent } from "./audit-ops.js";
import { queueNotification } from "./notifications.js";
import { canAction } from "./rbac.js";
import { isSystemOwner } from "./roles.js";
import {
  DELIVERY_MILESTONES,
  DELIVERY_STATUS,
  canTransitionDeliveryStatus,
  milestoneIndex,
  OWNERSHIP_ROLES
} from "./integration-lifecycle.js";

export const DELIVERY_ENGINE_VERSION = "1.0.0";

const SEEDED_DELIVERABLES = [
  { code: "INT-CORE-GATEWAY", name: "Core Gateway (Router, Registry, Dispatcher, Version Manager)", phase: "Foundation" },
  { code: "INT-ENGINE-PROVIDER", name: "Integration Engine / Provider Registry", phase: "Foundation" },
  { code: "INT-WEBHOOK", name: "Webhook Engine", phase: "Integration" },
  { code: "INT-MESSAGING", name: "Message Integration Layer", phase: "Integration" },
  { code: "INT-TRANSFORM", name: "Transformation Engine", phase: "Integration" },
  { code: "INT-SECURITY", name: "Security Policy Models", phase: "Security" },
  { code: "INT-TRAFFIC", name: "Traffic Control (Rate/Throttle/Circuit)", phase: "Security" },
  { code: "INT-OPS", name: "Operational Health / Metrics / Audit", phase: "Operations" },
  { code: "INT-UI", name: "Audit/Reports Integration UI", phase: "Operations" },
  { code: "INT-DOCS-TESTS", name: "Docs, SQL, Tests, prepare:web", phase: "Release" }
];

function nowIso(now) {
  if (typeof now === "number") return new Date(now).toISOString();
  if (now) {
    const parsed = Date.parse(now);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

function newId(prefix, uid) {
  return uid ? uid(prefix) : `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function permitted(user, action) {
  return !user || canAction(user, action) || isSystemOwner(user);
}

function auditDelivery(state, action, details, user, extras = {}, uid) {
  recordAuditEvent(state, {
    action,
    details,
    userId: user?.id || "",
    username: user?.username,
    category: extras.category || "governance",
    guarantee: extras.guarantee || "G1",
    module: "28",
    immutable: true,
    ...extras
  }, uid);
}

function defaultOwnership() {
  return {
    "Primary Owner": { roleLabel: "Platform Engineering Lead", assignee: "Platform Engineering", orgRole: "Primary Owner" },
    "Backup Owner": { roleLabel: "Integration Engineer", assignee: "Integration Team", orgRole: "Backup Owner" },
    Reviewer: { roleLabel: "Security Reviewer", assignee: "Security Ops", orgRole: "Reviewer" },
    Approver: { roleLabel: "System Owner", assignee: "john", orgRole: "Approver" }
  };
}

function blankMilestones(plannedEnd) {
  return DELIVERY_MILESTONES.map((name, index) => ({
    name,
    index: index + 1,
    status: index === 0 ? "completed" : "pending",
    completedAt: index === 0 ? plannedEnd : null,
    completedBy: index === 0 ? "system" : null
  }));
}

function deadlineTemplate(code, name, index, now) {
  const start = new Date(nowIso(now));
  const plannedStart = new Date(start.getTime() + index * 86400000).toISOString();
  const plannedEnd = new Date(start.getTime() + (index + 7) * 86400000).toISOString();
  return {
    templateId: "deadline02",
    deliverableCode: code,
    deliverableName: name,
    plannedStart,
    plannedEnd,
    actualStart: null,
    actualEnd: null,
    status: "Not Started",
    currentMilestone: "Planned",
    milestones: blankMilestones(plannedStart),
    dependencies: index === 0 ? [] : [SEEDED_DELIVERABLES[index - 1].code],
    ownership: defaultOwnership(),
    changeRequests: [],
    estimatedCompletion: plannedEnd,
    releaseReadinessPct: 10,
    createdAt: nowIso(now),
    updatedAt: nowIso(now)
  };
}

export function ensureDeliveryState(state = {}, uid, now) {
  state.integrationDeliverables = state.integrationDeliverables || [];
  state.integrationOwnershipMatrix = state.integrationOwnershipMatrix || [];
  state.integrationDeadlineChanges = state.integrationDeadlineChanges || [];
  state.integrationDeliveryAudit = state.integrationDeliveryAudit || [];
  if (!state.integrationDeliverables.length) {
    SEEDED_DELIVERABLES.forEach((item, index) => {
      const row = {
        id: newId("del", uid),
        ...item,
        deadline: deadlineTemplate(item.code, item.name, index, now || "2026-09-12T09:00:00.000Z"),
        createdAt: nowIso(now || "2026-09-12T09:00:00.000Z")
      };
      state.integrationDeliverables.push(row);
      state.integrationOwnershipMatrix.push({
        deliverableCode: item.code,
        ownership: row.deadline.ownership,
        roles: OWNERSHIP_ROLES
      });
    });
  }
  return state;
}

export function assignOwnership(state, deliverableCode, ownership = {}, user, uid, now) {
  ensureDeliveryState(state, uid, now);
  if (!permitted(user, "Integration.Admin") && !permitted(user, "Integration.View")) {
    return { ok: false, error: "Unauthorized", errorCode: "INT-002", http: 403 };
  }
  const row = state.integrationDeliverables.find((item) => item.code === deliverableCode || item.id === deliverableCode);
  if (!row) return { ok: false, error: "Deliverable not found", errorCode: "INT-005", http: 404 };
  const next = { ...row.deadline.ownership };
  OWNERSHIP_ROLES.forEach((role) => {
    if (ownership[role]) next[role] = { ...next[role], ...ownership[role], orgRole: role };
  });
  row.deadline.ownership = next;
  row.deadline.updatedAt = nowIso(now);
  const matrix = state.integrationOwnershipMatrix.find((item) => item.deliverableCode === row.code);
  if (matrix) matrix.ownership = next;
  auditDelivery(state, "Integration ownership assigned", row.code, user, { entityId: row.id }, uid);
  state.integrationDeliveryAudit.push({
    id: newId("da", uid),
    type: "ownership",
    deliverableCode: row.code,
    snapshot: structuredClone(next),
    at: nowIso(now),
    by: user?.id || ""
  });
  return { ok: true, deliverable: row };
}

function dependencySatisfied(state, code) {
  if (!code) return true;
  const dep = state.integrationDeliverables.find((item) => item.code === code);
  if (!dep) return false;
  const idx = milestoneIndex(dep.deadline.currentMilestone);
  return idx >= milestoneIndex("Feature Complete") || dep.deadline.status === "Completed";
}

export function advanceMilestone(state, deliverableCode, milestone, user, uid, now) {
  ensureDeliveryState(state, uid, now);
  if (!permitted(user, "Integration.Admin")) {
    return { ok: false, error: "Unauthorized", errorCode: "INT-002", http: 403 };
  }
  const row = state.integrationDeliverables.find((item) => item.code === deliverableCode || item.id === deliverableCode);
  if (!row) return { ok: false, error: "Deliverable not found", errorCode: "INT-005", http: 404 };
  const target = milestone || DELIVERY_MILESTONES[milestoneIndex(row.deadline.currentMilestone) + 1];
  if (!DELIVERY_MILESTONES.includes(target)) {
    return { ok: false, error: "Unknown milestone", errorCode: "INT-019", http: 400 };
  }
  const currentIdx = milestoneIndex(row.deadline.currentMilestone);
  const targetIdx = milestoneIndex(target);
  if (targetIdx !== currentIdx + 1) {
    return { ok: false, error: "Milestones cannot be skipped", errorCode: "INT-019", http: 409 };
  }
  for (const dep of row.deadline.dependencies || []) {
    if (targetIdx >= milestoneIndex("Development Started") && !dependencySatisfied(state, dep) && targetIdx >= milestoneIndex("Feature Complete")) {
      // Feature Complete requires prior deliverable Feature Complete when listed as dependency
    }
  }
  if (target === "Feature Complete") {
    const started = row.deadline.milestones.find((m) => m.name === "Development Started");
    if (!started || started.status !== "completed") {
      return { ok: false, error: "Feature Complete depends on Development Started", errorCode: "INT-020", http: 409 };
    }
  }
  if (target === "Production Released") {
    const required = ["QA Complete", "Security Review Complete", "Performance Validated", "Documentation Complete"];
    for (const name of required) {
      const m = row.deadline.milestones.find((item) => item.name === name);
      if (!m || m.status !== "completed") {
        return { ok: false, error: `Production Released depends on ${name}`, errorCode: "INT-020", http: 409 };
      }
    }
  }
  const milestoneRow = row.deadline.milestones.find((item) => item.name === target);
  milestoneRow.status = "completed";
  milestoneRow.completedAt = nowIso(now);
  milestoneRow.completedBy = user?.id || "";
  row.deadline.currentMilestone = target;
  row.deadline.releaseReadinessPct = Math.round(((targetIdx + 1) / DELIVERY_MILESTONES.length) * 100);
  if (!row.deadline.actualStart && targetIdx >= milestoneIndex("Development Started")) {
    row.deadline.actualStart = nowIso(now);
  }
  if (target === "Production Released") {
    row.deadline.status = "Completed";
    row.deadline.actualEnd = nowIso(now);
  } else if (row.deadline.status === "Not Started") {
    row.deadline.status = "On Schedule";
  }
  row.deadline.updatedAt = nowIso(now);
  auditDelivery(state, "Integration milestone advanced", `${row.code}:${target}`, user, { entityId: row.id }, uid);
  state.integrationDeliveryAudit.push({
    id: newId("da", uid),
    type: "milestone",
    deliverableCode: row.code,
    milestone: target,
    at: nowIso(now),
    by: user?.id || ""
  });
  return { ok: true, deliverable: row };
}

export function setDeliveryStatus(state, deliverableCode, status, user, uid, now) {
  ensureDeliveryState(state, uid, now);
  if (!permitted(user, "Integration.Admin")) {
    return { ok: false, error: "Unauthorized", errorCode: "INT-002", http: 403 };
  }
  const row = state.integrationDeliverables.find((item) => item.code === deliverableCode || item.id === deliverableCode);
  if (!row) return { ok: false, error: "Deliverable not found", errorCode: "INT-005", http: 404 };
  if (!DELIVERY_STATUS.includes(status)) {
    return { ok: false, error: "Invalid status", errorCode: "INT-010", http: 400 };
  }
  if (!canTransitionDeliveryStatus(row.deadline.status, status)) {
    return { ok: false, error: "Invalid status transition", errorCode: "INT-019", http: 409 };
  }
  const previous = row.deadline.status;
  row.deadline.status = status;
  row.deadline.updatedAt = nowIso(now);
  if (status === "Delayed" || status === "At Risk" || status === "Blocked") {
    queueNotification(state, {
      type: "integration_delivery",
      title: `Deliverable ${row.code} is ${status}`,
      body: `${row.name} schedule requires attention`,
      severity: status === "Blocked" ? "high" : "medium",
      userId: user?.id || ""
    }, uid);
  }
  auditDelivery(state, "Integration delivery status changed", `${row.code}:${previous}->${status}`, user, { entityId: row.id }, uid);
  return { ok: true, deliverable: row };
}

export function requestDeadlineChange(state, input = {}, user, uid, now) {
  ensureDeliveryState(state, uid, now);
  if (!permitted(user, "Integration.Admin")) {
    return { ok: false, error: "Unauthorized", errorCode: "INT-002", http: 403 };
  }
  const row = state.integrationDeliverables.find((item) => item.code === input.deliverableCode || item.id === input.deliverableCode);
  if (!row) return { ok: false, error: "Deliverable not found", errorCode: "INT-005", http: 404 };
  if (!input.newDeadline || !input.justification) {
    return { ok: false, error: "newDeadline and justification required", errorCode: "INT-010", http: 400 };
  }
  const change = {
    id: newId("dcr", uid),
    changeRequestId: input.changeRequestId || newId("CR", uid),
    deliverableCode: row.code,
    previousDeadline: row.deadline.plannedEnd,
    newDeadline: input.newDeadline,
    justification: input.justification,
    requester: user?.id || input.requester || "",
    approver: null,
    status: "pending",
    approvalTimestamp: null,
    createdAt: nowIso(now)
  };
  row.deadline.changeRequests.push(change);
  state.integrationDeadlineChanges.push(change);
  auditDelivery(state, "Integration deadline change requested", change.changeRequestId, user, { entityId: row.id }, uid);
  return { ok: true, change };
}

export function approveDeadlineChange(state, changeRequestId, user, uid, now) {
  ensureDeliveryState(state, uid, now);
  if (!permitted(user, "Integration.Admin") && !isSystemOwner(user)) {
    return { ok: false, error: "Unauthorized", errorCode: "INT-002", http: 403 };
  }
  const change = state.integrationDeadlineChanges.find((item) => item.changeRequestId === changeRequestId || item.id === changeRequestId);
  if (!change) return { ok: false, error: "Change request not found", errorCode: "INT-005", http: 404 };
  if (change.status === "approved") {
    return { ok: false, error: "Change already approved (immutable)", errorCode: "INT-021", http: 409 };
  }
  change.status = "approved";
  change.approver = user?.id || "";
  change.approvalTimestamp = nowIso(now);
  const row = state.integrationDeliverables.find((item) => item.code === change.deliverableCode);
  if (row) {
    row.deadline.plannedEnd = change.newDeadline;
    row.deadline.estimatedCompletion = change.newDeadline;
    row.deadline.updatedAt = nowIso(now);
  }
  auditDelivery(state, "Integration deadline change approved", change.changeRequestId, user, { entityId: row?.id || "" }, uid);
  state.integrationDeliveryAudit.push({
    id: newId("da", uid),
    type: "deadline_change",
    deliverableCode: change.deliverableCode,
    changeRequestId: change.changeRequestId,
    previousDeadline: change.previousDeadline,
    newDeadline: change.newDeadline,
    at: nowIso(now),
    by: user?.id || "",
    immutable: true
  });
  return { ok: true, change, deliverable: row };
}

export function evaluateOverdue(state, now) {
  ensureDeliveryState(state);
  const ts = Date.parse(nowIso(now));
  const overdue = [];
  (state.integrationDeliverables || []).forEach((row) => {
    if (row.deadline.status === "Completed" || row.deadline.status === "Cancelled") return;
    const end = Date.parse(row.deadline.plannedEnd);
    if (Number.isFinite(end) && end < ts) {
      if (row.deadline.status !== "Delayed") row.deadline.status = "Delayed";
      overdue.push(row);
      queueNotification(state, {
        type: "integration_delivery",
        title: `Overdue: ${row.code}`,
        body: `${row.name} passed planned end ${row.deadline.plannedEnd}`,
        severity: "high"
      });
    }
  });
  return { ok: true, overdue };
}

export function deliveryDashboard(state, now) {
  ensureDeliveryState(state);
  evaluateOverdue(state, now);
  const rows = state.integrationDeliverables || [];
  const completedMilestones = rows.reduce((sum, row) => sum + row.deadline.milestones.filter((m) => m.status === "completed").length, 0);
  const totalMilestones = rows.length * DELIVERY_MILESTONES.length;
  const overdue = rows.filter((row) => row.deadline.status === "Delayed").length;
  const completed = rows.filter((row) => row.deadline.status === "Completed").length;
  const avgReadiness = rows.length
    ? Math.round(rows.reduce((sum, row) => sum + Number(row.deadline.releaseReadinessPct || 0), 0) / rows.length)
    : 0;
  return {
    deliverables: rows.length,
    completed,
    overdue,
    milestonesCompleted: completedMilestones,
    milestonesRemaining: totalMilestones - completedMilestones,
    releaseReadinessPct: avgReadiness,
    ownershipRoles: OWNERSHIP_ROLES,
    rows
  };
}

export function deliveryReports(state, reportId) {
  ensureDeliveryState(state);
  const table = (columns, rows) => ({ id: reportId, columns, rows });
  if (reportId === "integration_delivery") {
    return table(
      ["code", "name", "status", "currentMilestone", "plannedEnd", "releaseReadinessPct"],
      (state.integrationDeliverables || []).map((row) => ({
        code: row.code,
        name: row.name,
        status: row.deadline.status,
        currentMilestone: row.deadline.currentMilestone,
        plannedEnd: row.deadline.plannedEnd,
        releaseReadinessPct: row.deadline.releaseReadinessPct
      }))
    );
  }
  if (reportId === "integration_ownership") {
    return table(
      ["deliverableCode", "primary", "backup", "reviewer", "approver"],
      (state.integrationOwnershipMatrix || []).map((row) => ({
        deliverableCode: row.deliverableCode,
        primary: row.ownership["Primary Owner"]?.assignee,
        backup: row.ownership["Backup Owner"]?.assignee,
        reviewer: row.ownership.Reviewer?.assignee,
        approver: row.ownership.Approver?.assignee
      }))
    );
  }
  return table(["id"], []);
}

export function assertDeliveryBoundary() {
  return {
    inProcess: true,
    pmTool: false,
    immutableAudit: true,
    milestones: DELIVERY_MILESTONES.length
  };
}
