/**
 * Global transaction status model as a derived view over existing records.
 * Modules keep their stored status strings; this layer standardizes reporting/API shape.
 */

export const LIFECYCLE = [
  "Draft", "Submitted", "Validating", "Validation Failed", "Validation Passed",
  "Pending Approval", "Partially Approved", "Approved", "Processing",
  "Posted", "Completed", "Cancelled", "Rejected", "Failed", "Reversed"
];

export const VALIDATION_STATUS = ["Not Started", "In Progress", "Passed", "Failed"];
export const APPROVAL_STATUS = ["Not Required", "Pending", "Partially Approved", "Approved", "Rejected", "Expired", "Cancelled"];
export const ACCOUNTING_STATUS = ["Not Posted", "Pending Posting", "Posted", "Reversed", "Failed"];
export const PAYMENT_STATUS = ["Not Applicable", "Pending", "Partially Paid", "Paid", "Failed", "Refunded", "Reversed"];
export const SYNC_STATUS = ["Not Required", "Pending", "Synchronizing", "Synchronized", "Failed", "Conflict Detected"];
export const NOTIFICATION_STATUS = ["Not Required", "Pending", "Sent", "Partially Sent", "Failed"];

const WITHDRAWAL_MAP = {
  Requested: { lifecycle: "Pending Approval", validation: "Passed", approval: "Pending", accounting: "Not Posted", payment: "Pending" },
  Verified: { lifecycle: "Pending Approval", validation: "Passed", approval: "Pending", accounting: "Not Posted", payment: "Pending" },
  Approved: { lifecycle: "Approved", validation: "Passed", approval: "Approved", accounting: "Not Posted", payment: "Pending" },
  Paid: { lifecycle: "Completed", validation: "Passed", approval: "Approved", accounting: "Posted", payment: "Paid" },
  Rejected: { lifecycle: "Rejected", validation: "Passed", approval: "Rejected", accounting: "Not Posted", payment: "Failed" },
  Cancelled: { lifecycle: "Cancelled", validation: "Passed", approval: "Cancelled", accounting: "Not Posted", payment: "Not Applicable" },
  Reversed: { lifecycle: "Reversed", validation: "Passed", approval: "Approved", accounting: "Reversed", payment: "Reversed" }
};

const LOAN_MAP = {
  Pending: { lifecycle: "Pending Approval", validation: "Passed", approval: "Pending", accounting: "Not Posted", payment: "Not Applicable" },
  Verified: { lifecycle: "Pending Approval", validation: "Passed", approval: "Pending", accounting: "Not Posted", payment: "Not Applicable" },
  Approved: { lifecycle: "Approved", validation: "Passed", approval: "Approved", accounting: "Not Posted", payment: "Not Applicable" },
  Rejected: { lifecycle: "Rejected", validation: "Passed", approval: "Rejected", accounting: "Not Posted", payment: "Not Applicable" },
  Cancelled: { lifecycle: "Cancelled", validation: "Passed", approval: "Cancelled", accounting: "Not Posted", payment: "Not Applicable" },
  Disbursed: { lifecycle: "Posted", validation: "Passed", approval: "Approved", accounting: "Posted", payment: "Paid" },
  Active: { lifecycle: "Completed", validation: "Passed", approval: "Approved", accounting: "Posted", payment: "Partially Paid" },
  Completed: { lifecycle: "Completed", validation: "Passed", approval: "Approved", accounting: "Posted", payment: "Paid" },
  Settled: { lifecycle: "Completed", validation: "Passed", approval: "Approved", accounting: "Posted", payment: "Paid" },
  Defaulted: { lifecycle: "Completed", validation: "Passed", approval: "Approved", accounting: "Posted", payment: "Partially Paid" }
};

export function deriveStatusView(record = {}, kind = "collection") {
  if (kind === "withdrawal") {
    const mapped = WITHDRAWAL_MAP[record.status] || WITHDRAWAL_MAP.Requested;
    return viewFromMap(record, mapped, "Withdrawal");
  }
  if (kind === "loan") {
    const mapped = LOAN_MAP[record.status] || LOAN_MAP.Pending;
    return viewFromMap(record, mapped, "Loan");
  }
  if (record.reversed) {
    return viewFromMap(record, {
      lifecycle: "Reversed",
      validation: "Passed",
      approval: "Approved",
      accounting: "Reversed",
      payment: "Reversed"
    }, "Collection");
  }
  return viewFromMap(record, {
    lifecycle: "Completed",
    validation: "Passed",
    approval: "Not Required",
    accounting: "Posted",
    payment: "Paid"
  }, "Collection");
}

function viewFromMap(record, mapped, type) {
  return {
    transaction_id: record.id || "",
    transaction_number: record.receiptNo || record.paymentNo || record.id || "",
    lifecycle_status: mapped.lifecycle,
    validation_status: mapped.validation,
    approval_status: mapped.approval,
    accounting_status: mapped.accounting,
    payment_status: mapped.payment,
    synchronization_status: record.syncStatus || "Not Required",
    notification_status: record.notified ? "Sent" : "Not Required",
    transaction_type: type,
    derived: true
  };
}

export function derivedDisplayStatus(view) {
  if (view.lifecycle_status === "Posted" && view.accounting_status === "Posted") return "Completed";
  return view.lifecycle_status;
}
