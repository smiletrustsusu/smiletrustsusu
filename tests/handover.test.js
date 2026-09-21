import test from "node:test";
import assert from "node:assert/strict";
import {
  expectedCashForCollector,
  buildHandoverRecord,
  verifyHandover,
  handoverExceptions
} from "../src/core/handover.js";

test("expected cash uses verified cash collections only", () => {
  const state = {};
  const collections = [
    { userId: "u-col", date: "2026-09-02", amount: 100, paymentMethod: "Cash", verificationStatus: "Verified" },
    { userId: "u-col", date: "2026-09-02", amount: 40, paymentMethod: "Mobile Money", verificationStatus: "Verified" },
    { userId: "u-col", date: "2026-09-02", amount: 20, paymentMethod: "Cash", verificationStatus: "Pending Verification" }
  ];
  const expected = expectedCashForCollector(state, "u-col", "2026-09-02", { collections });
  assert.equal(expected, 100);
});

test("handover verification records shortage exceptions", () => {
  const handover = buildHandoverRecord(
    { collections: [{ userId: "u-col", date: "2026-09-02", amount: 100, paymentMethod: "Cash", verificationStatus: "Verified" }] },
    { id: "h1", collectorId: "u-col", groupId: "g1", date: "2026-09-02", declaredCash: 80, userId: "u-col" }
  );
  verifyHandover(handover, { countedCash: 75, verifiedBy: "u-owner" });
  const exceptions = handoverExceptions(handover);
  assert.ok(exceptions.some((item) => item.type === "shortage_counted"));
});
