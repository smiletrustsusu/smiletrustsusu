/**
 * Phase 2 — architecture review workflow state machine tests.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  ARW_STAGES,
  ARW_FINDING_STATES,
  ARW_STAGE_EXIT_DELIVERABLES,
  canAdvanceStage,
  canTransitionFinding,
  evaluateExitGate,
  missingExitDeliverables,
  assertApprovalSeparationOfDuties,
  createImmutableAuditLog,
  ensureArchitectureReviewState,
  createArchitectureReview,
  setDeliverableFlag,
  assignReviewers,
  advanceReviewStage,
  setReviewBlocked,
  addFinding,
  transitionFinding,
  approveArchitectureReview,
  assertArchitectureReviewBoundary
} from "../src/core/architecture-review-workflow.js";

const now = "2026-09-12T15:00:00.000Z";

function seedFlagsThrough(stageName) {
  const flags = {};
  for (const stage of ARW_STAGES) {
    for (const key of ARW_STAGE_EXIT_DELIVERABLES[stage] || []) {
      flags[key] = true;
    }
    if (stage === stageName) break;
  }
  return flags;
}

test("stages are ordered and cannot skip", () => {
  assert.equal(ARW_STAGES.length, 14);
  assert.equal(canAdvanceStage("Planned", "Review Initiated"), true);
  assert.equal(canAdvanceStage("Planned", "Evidence Collection"), false);
  assert.equal(canAdvanceStage("Approved", "Closed"), true);
  assert.equal(canAdvanceStage("Closed", "Planned"), false);
  assert.equal(canAdvanceStage("Technical", "Security"), true);
  assert.equal(canAdvanceStage("Technical", "Integration"), false);
});

test("exit gate helpers require deliverable flags", () => {
  const empty = evaluateExitGate("Review Initiated", {});
  assert.equal(empty.ok, false);
  assert.equal(empty.errorCode, "ARW-003");
  assert.deepEqual(missingExitDeliverables("Review Initiated", {}).sort(), [
    "reviewersAssigned",
    "scopeLocked"
  ].sort());

  const ok = evaluateExitGate("Review Initiated", {
    reviewersAssigned: true,
    scopeLocked: true
  });
  assert.equal(ok.ok, true);
});

test("finding lifecycle Identified → … → Closed and rejects illegal jumps", () => {
  assert.equal(canTransitionFinding("Identified", "Triaged"), true);
  assert.equal(canTransitionFinding("Identified", "Closed"), false);
  assert.equal(canTransitionFinding("Triaged", "Accepted"), true);
  assert.equal(canTransitionFinding("Accepted", "Remediated"), true);
  assert.equal(canTransitionFinding("Remediated", "Verified"), true);
  assert.equal(canTransitionFinding("Verified", "Closed"), true);
  assert.equal(canTransitionFinding("Rejected", "Closed"), true);
  assert.equal(canTransitionFinding("Closed", "Identified"), false);
  assert.ok(ARW_FINDING_STATES.includes("Identified"));
});

test("SoD: same user cannot solely approve a review they alone conducted", () => {
  const bad = assertApprovalSeparationOfDuties({
    reviewerIds: ["alice"],
    soleReviewerIds: ["alice"],
    approverId: "alice"
  });
  assert.equal(bad.ok, false);
  assert.equal(bad.errorCode, "ARW-008");

  const good = assertApprovalSeparationOfDuties({
    reviewerIds: ["alice", "bob"],
    soleReviewerIds: ["alice"],
    approverId: "carol"
  });
  assert.equal(good.ok, true);
});

test("immutable audit log is append-only snapshot", () => {
  const log = createImmutableAuditLog();
  log.append({ type: "a", at: now });
  const snap = log.snapshot();
  assert.equal(snap.length, 1);
  assert.throws(() => {
    snap.push({ type: "hack" });
  });
});

test("review advances sequentially with gates; blocked state stops progress", () => {
  const state = ensureArchitectureReviewState({});
  const created = createArchitectureReview(state, {
    reviewId: "arw-test-1",
    initiatedBy: "lead",
    modulesInScope: [1, 30],
    aiInScope: true,
    now
  });
  assert.equal(created.ok, true);
  assert.equal(created.review.stage, "Planned");

  const skip = advanceReviewStage(state, "arw-test-1", { actorId: "lead", now });
  assert.equal(skip.ok, false);
  assert.equal(skip.errorCode, "ARW-003");

  setDeliverableFlag(state, "arw-test-1", "charterApproved", true, { actorId: "lead", now });
  const step1 = advanceReviewStage(state, "arw-test-1", { actorId: "lead", now });
  assert.equal(step1.ok, true);
  assert.equal(step1.to, "Review Initiated");

  assignReviewers(state, "arw-test-1", ["alice", "bob"], {
    soleReviewerIds: ["alice"],
    actorId: "lead",
    now
  });
  setDeliverableFlag(state, "arw-test-1", "scopeLocked", true, { actorId: "lead", now });

  setReviewBlocked(state, "arw-test-1", true, "validation_failed", { actorId: "lead", now });
  const blocked = advanceReviewStage(state, "arw-test-1", { actorId: "lead", now });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.errorCode, "ARW-004");
  setReviewBlocked(state, "arw-test-1", false, "", { actorId: "lead", now });

  const step2 = advanceReviewStage(state, "arw-test-1", { actorId: "lead", now });
  assert.equal(step2.ok, true);
  assert.equal(step2.to, "Evidence Collection");
});

test("finding transitions on a live review record", () => {
  const state = ensureArchitectureReviewState({});
  createArchitectureReview(state, { reviewId: "arw-f1", initiatedBy: "lead", now });
  const added = addFinding(state, "arw-f1", {
    findingId: "ECR-M01",
    severity: "Medium",
    title: "REST terminology",
    actorId: "alice",
    now
  });
  assert.equal(added.ok, true);
  assert.equal(added.finding.status, "Identified");

  assert.equal(transitionFinding(state, "arw-f1", "ECR-M01", "Closed", { actorId: "alice", now }).ok, false);

  assert.equal(transitionFinding(state, "arw-f1", "ECR-M01", "Triaged", { actorId: "alice", now }).ok, true);
  assert.equal(transitionFinding(state, "arw-f1", "ECR-M01", "Accepted", { actorId: "bob", now }).ok, true);
  assert.equal(transitionFinding(state, "arw-f1", "ECR-M01", "Remediated", { actorId: "bob", now }).ok, true);
  assert.equal(transitionFinding(state, "arw-f1", "ECR-M01", "Verified", { actorId: "alice", now }).ok, true);
  assert.equal(transitionFinding(state, "arw-f1", "ECR-M01", "Closed", { actorId: "alice", now }).ok, true);
});

test("approval enforces SoD and moves Final Approval Review → Approved", () => {
  const state = ensureArchitectureReviewState({});
  createArchitectureReview(state, { reviewId: "arw-appr", initiatedBy: "lead", now });
  const review = state.architectureReviews[0];
  review.stage = "Final Approval Review";
  review.deliverableFlags = seedFlagsThrough("Final Approval Review");
  review.reviewerIds = ["alice"];
  review.soleReviewerIds = ["alice"];

  const sodFail = approveArchitectureReview(state, "arw-appr", { approverId: "alice", now });
  assert.equal(sodFail.ok, false);
  assert.equal(sodFail.errorCode, "ARW-008");

  review.reviewerIds = ["alice", "bob"];
  const ok = approveArchitectureReview(state, "arw-appr", { approverId: "carol", decision: "Conditional", now });
  assert.equal(ok.ok, true);
  assert.equal(ok.review.stage, "Approved");
  assert.equal(ok.review.approval.decision, "Conditional");
});

test("governance boundary does not claim money or HTTP servers", () => {
  const b = assertArchitectureReviewBoundary();
  assert.equal(b.postsCollections, false);
  assert.equal(b.changesMoneyMath, false);
  assert.equal(b.changesRbacForbidden, false);
  assert.equal(b.restHttp, false);
  assert.equal(b.graphqlHttp, false);
  assert.equal(b.governanceOnly, true);
});
