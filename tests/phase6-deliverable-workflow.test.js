/**
 * Phase 6 deliverable workflow — stages, statuses, SoD, AWC, publish gates.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  P6_STAGES,
  P6_STATUSES,
  P6_STATUS_TRANSITIONS,
  createDeliverable,
  completeStage,
  transitionStatus,
  isTransitionAllowed,
  assertSod,
  addFinding,
  closeFinding,
  addCondition,
  closeCondition,
  openConditions,
  recordApproval,
  canApproveWithConditions,
  allStagesComplete,
  getAuditLog,
  listStages,
  listStatuses
} from "../src/core/phase6-deliverable-workflow.js";

test("exactly 11 stages and 16 statuses", () => {
  assert.equal(listStages().length, 11);
  assert.equal(P6_STAGES.length, 11);
  assert.equal(listStatuses().length, 16);
  assert.equal(P6_STATUSES.length, 16);
  assert.equal(Object.keys(P6_STATUS_TRANSITIONS).length, 16);
});

test("stage sequencing cannot skip; criteria required", () => {
  const created = createDeliverable({
    primaryOwner: "alice",
    accountableApprover: "bob",
    independentReviewer: "carol"
  });
  assert.equal(created.ok, true);
  const d = created.deliverable;

  const skip = completeStage(d, 3, { criteriaMet: true, actor: "alice" });
  assert.equal(skip.ok, false);
  assert.equal(skip.code, "P6W-062");

  const noCrit = completeStage(d, 1, { criteriaMet: false, actor: "alice" });
  assert.equal(noCrit.ok, false);
  assert.equal(noCrit.code, "P6W-063");

  for (let i = 1; i <= 11; i++) {
    const r = completeStage(d, i, { criteriaMet: true, actor: "alice" });
    assert.equal(r.ok, true, `stage ${i}: ${r.code} ${r.message}`);
  }
  assert.equal(allStagesComplete(d), true);
  assert.ok(getAuditLog(d).length >= 12);
});

test("status transitions enforce allowed matrix only", () => {
  assert.equal(isTransitionAllowed("NotStarted", "Draft"), true);
  assert.equal(isTransitionAllowed("Draft", "Published"), false);

  const created = createDeliverable({
    primaryOwner: "alice",
    accountableApprover: "bob",
    independentReviewer: "carol"
  });
  const d = created.deliverable;
  assert.equal(transitionStatus(d, "Draft", { actor: "alice" }).ok, true);
  const bad = transitionStatus(d, "Published", { actor: "alice" });
  assert.equal(bad.ok, false);
  assert.equal(bad.code, "P6W-021");
  assert.equal(transitionStatus(d, "InAuthoring").ok, true);
  assert.equal(transitionStatus(d, "Submitted").ok, true);
  assert.equal(transitionStatus(d, "UnderReview").ok, true);
  assert.equal(transitionStatus(d, "PendingApproval").ok, true);
  assert.equal(transitionStatus(d, "Approved").ok, true);
});

test("SoD: owner ≠ approver; owner ≠ sole independent reviewer", () => {
  const bad = createDeliverable({
    primaryOwner: "alice",
    accountableApprover: "alice",
    independentReviewer: "carol"
  });
  assert.equal(bad.ok, false);
  assert.equal(bad.code, "P6W-010");

  const bad2 = createDeliverable({
    primaryOwner: "alice",
    accountableApprover: "bob",
    independentReviewer: "alice"
  });
  assert.equal(bad2.ok, false);
  assert.equal(bad2.code, "P6W-011");

  const ok = createDeliverable({
    primaryOwner: "alice",
    accountableApprover: "bob",
    independentReviewer: "carol"
  });
  assert.equal(ok.ok, true);
  assert.equal(assertSod(ok.deliverable).ok, true);
});

test("Approved-with-Conditions: no Critical; conditions block baseline", () => {
  const created = createDeliverable({
    primaryOwner: "alice",
    accountableApprover: "bob",
    independentReviewer: "carol"
  });
  const d = created.deliverable;
  for (const s of ["Draft", "InAuthoring", "Submitted", "UnderReview", "PendingApproval"]) {
    assert.equal(transitionStatus(d, s).ok, true, s);
  }

  addFinding(d, { severity: "Critical", summary: "blocker" });
  const blocked = canApproveWithConditions(d);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, "P6W-030");
  assert.equal(transitionStatus(d, "ApprovedWithConditions").ok, false);

  closeFinding(d, d.findings[0].id);
  assert.equal(canApproveWithConditions(d).ok, true);
  assert.equal(transitionStatus(d, "ApprovedWithConditions").ok, true);
  addCondition(d, { summary: "fix docs" });
  assert.equal(openConditions(d).length, 1);
  assert.equal(transitionStatus(d, "ConditionsInProgress").ok, true);

  // cannot jump to Baselined
  assert.equal(isTransitionAllowed("ConditionsInProgress", "Baselined"), false);

  closeCondition(d, d.conditions[0].id);
  assert.equal(openConditions(d).length, 0);
  assert.equal(transitionStatus(d, "Approved").ok, true);
  assert.equal(transitionStatus(d, "BaselineCandidate").ok, true);
  assert.equal(transitionStatus(d, "Baselined").ok, true);
});

test("cannot publish without approvals", () => {
  const created = createDeliverable({
    primaryOwner: "alice",
    accountableApprover: "bob",
    independentReviewer: "carol"
  });
  const d = created.deliverable;
  for (const s of ["Draft", "InAuthoring", "Submitted", "UnderReview", "PendingApproval", "Approved", "BaselineCandidate", "Baselined"]) {
    assert.equal(transitionStatus(d, s).ok, true, s);
  }
  const denied = transitionStatus(d, "Published", { actor: "bob" });
  assert.equal(denied.ok, false);
  assert.equal(denied.code, "P6W-050");

  recordApproval(d, "primaryOwner", { actor: "alice" });
  recordApproval(d, "accountableApprover", { actor: "bob" });
  recordApproval(d, "independentReviewer", { actor: "carol" });
  recordApproval(d, "finalQuality", { actor: "dave" });
  assert.equal(transitionStatus(d, "Published", { actor: "bob" }).ok, true);
  assert.ok(getAuditLog(d).some((e) => e.action === "STATUS_TRANSITION" && e.to === "Published"));
});