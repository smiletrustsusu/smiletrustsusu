import test from "node:test";
import assert from "node:assert/strict";
import { approveReversal, createReversalRequest } from "../src/core/reversals.js";

function uid(prefix) {
  return `${prefix}-test`;
}

test("reversal creates offsetting ledger entry and marks collection reversed", () => {
  const state = {
    settings: { assistantCanApproveReversals: false },
    collections: [{
      id: "col-1",
      amount: 50,
      paymentMethod: "Cash",
      paymentReference: "",
      reversed: false
    }],
    reversals: [],
    ledgerEntries: [],
    transactions: []
  };
  const reversal = createReversalRequest(state, {
    id: "rev-1",
    originalCollection: state.collections[0],
    reason: "Wrong member",
    requestedBy: "u-admin",
    customerId: "cust-1",
    groupId: "grp-1",
    collectorId: "u-col"
  });
  const owner = { id: "u-owner", role: "KBA" };
  const result = approveReversal(state, reversal.id, owner, uid);
  assert.equal(result.ok, true);
  assert.equal(state.collections[0].reversed, true);
  assert.equal(state.ledgerEntries.length, 1);
  assert.equal(state.ledgerEntries[0].entryType, "Reversal");
  assert.equal(state.transactions.length, 1);
});
