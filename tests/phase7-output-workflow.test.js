/**
 * Phase 7 output workflow — section sequencing, audit, P7W codes.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  P7_SECTIONS,
  createPhase7Deliverable,
  completeSection,
  allSectionsComplete,
  getAuditLog,
  listSections,
  assertSectionOrder
} from "../src/core/phase7-output-workflow.js";

test("exactly 20 sections", () => {
  assert.equal(listSections().length, 20);
  assert.equal(P7_SECTIONS.length, 20);
  assert.equal(P7_SECTIONS[0].code, "DOCUMENT_CONTROL");
  assert.equal(P7_SECTIONS[19].code, "APPENDICES");
});

test("section sequencing cannot skip; criteria required", () => {
  const created = createPhase7Deliverable({
    primaryOwner: "alice",
    accountableApprover: "bob"
  });
  assert.equal(created.ok, true);
  const d = created.deliverable;

  const skip = completeSection(d, 3, { criteriaMet: true, actor: "alice" });
  assert.equal(skip.ok, false);
  assert.equal(skip.code, "P7W-062");

  const noCrit = completeSection(d, 1, { criteriaMet: false, actor: "alice" });
  assert.equal(noCrit.ok, false);
  assert.equal(noCrit.code, "P7W-063");

  for (let i = 1; i <= 20; i++) {
    const r = completeSection(d, i, { criteriaMet: true, actor: "alice" });
    assert.equal(r.ok, true, `section ${i}: ${r.code} ${r.message}`);
  }
  assert.equal(allSectionsComplete(d), true);
  assert.ok(getAuditLog(d).length >= 21);
});

test("SoD on create", () => {
  const bad = createPhase7Deliverable({
    primaryOwner: "alice",
    accountableApprover: "alice"
  });
  assert.equal(bad.ok, false);
  assert.equal(bad.code, "P7W-010");
});

test("assertSectionOrder matches P7_SECTIONS names", () => {
  const names = P7_SECTIONS.map((s) => s.name);
  assert.equal(assertSectionOrder(names).ok, true);
  assert.equal(assertSectionOrder(names.slice(0, 19)).ok, false);
  const shuffled = [...names];
  shuffled[0] = names[1];
  shuffled[1] = names[0];
  assert.equal(assertSectionOrder(shuffled).code, "P7W-070");
});
