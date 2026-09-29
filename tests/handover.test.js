import test from "node:test";
import assert from "node:assert/strict";
import {
  expectedCashForCollector,
  buildHandoverRecord,
  verifyHandover,
  handoverExceptions,
  listHandoverReceivers,
  pendingHandoversForReceiver,
  handoverStatusLabel,
  handoverIsConfirmed
} from "../src/core/handover.js";
import { canVerifyHandover } from "../src/core/permissions.js";

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

test("listHandoverReceivers returns manager accountant cashier roles", () => {
  const users = [
    { id: "c1", name: "Ama", role: "Collector", active: true },
    { id: "m1", name: "Kwame", role: "Admin", active: true, groupId: "g1" },
    { id: "a1", name: "Efua", role: "Accountant", active: true },
    { id: "x1", name: "Off", role: "Admin", active: false }
  ];
  const list = listHandoverReceivers(users, { excludeUserId: "c1", groupId: "g1" });
  assert.deepEqual(list.map((u) => u.id).sort(), ["a1", "m1"]);
});

test("assigned receiver can confirm; other manager cannot", () => {
  const handover = buildHandoverRecord(
    { collections: [{ userId: "u-col", date: "2026-09-02", amount: 100, paymentMethod: "Cash", verificationStatus: "Verified" }] },
    {
      id: "h1",
      collectorId: "u-col",
      groupId: "g1",
      date: "2026-09-02",
      declaredCash: 100,
      userId: "u-col",
      receiverId: "u-acct",
      receiverName: "Efua · Accountant"
    }
  );
  assert.equal(canVerifyHandover({ id: "u-acct", role: "Accountant" }, handover, {}), true);
  assert.equal(canVerifyHandover({ id: "u-admin", role: "Admin" }, handover, {}), false);
  assert.equal(canVerifyHandover({ id: "u-owner", role: "KBA" }, handover, {}), true);
  assert.equal(canVerifyHandover({ id: "u-col", role: "Collector" }, handover, {}), false);
});

test("handover confirmation marks received and pending list clears", () => {
  const handover = buildHandoverRecord(
    { collections: [{ userId: "u-col", date: "2026-09-02", amount: 100, paymentMethod: "Cash", verificationStatus: "Verified" }] },
    { id: "h1", collectorId: "u-col", groupId: "g1", date: "2026-09-02", declaredCash: 80, userId: "u-col", receiverId: "u-mgr" }
  );
  assert.equal(pendingHandoversForReceiver([handover], "u-mgr").length, 1);
  verifyHandover(handover, { countedCash: 75, verifiedBy: "u-mgr" });
  assert.equal(handoverIsConfirmed(handover), true);
  assert.equal(handoverStatusLabel(handover.status), "Received");
  assert.equal(pendingHandoversForReceiver([handover], "u-mgr").length, 0);
  const exceptions = handoverExceptions(handover);
  assert.ok(exceptions.some((item) => item.type === "shortage_counted"));
});
