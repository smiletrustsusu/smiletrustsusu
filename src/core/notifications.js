/**
 * In-app, SMS, WhatsApp, and email notification templates and queue.
 */
import { recordDuplicateHit } from "./idempotency.js";

export const CHANNELS = ["In-App", "SMS", "WhatsApp", "Email", "Push"];

export const NOTIFICATION_EVENTS = [
  "contribution_received",
  "withdrawal_approved",
  "withdrawal_requested",
  "withdrawal_rejected",
  "withdrawal_paid",
  "withdrawal_reversed",
  "savings_matured",
  "loan_due",
  "meeting_reminder",
  "missed_contribution",
  "birthday_wishes",
  "loan_disbursed",
  "handover_submitted",
  "large_deposit_alert",
  "target_achieved",
  "sync_complete",
  "receipt_generated",
  "duplicate_attempt",
  "workflow_task_assigned",
  "workflow_approval_request",
  "workflow_sla_warning",
  "workflow_sla_breach",
  "workflow_completed",
  "workflow_failed",
  "workflow_escalation",
  "workflow_case_updated",
  "rule_published",
  "rule_failed",
  "rule_approval_request",
  "exchange_import_completed",
  "exchange_export_completed",
  "exchange_export_approval",
  "records_uploaded",
  "records_archived",
  "records_hold",
  "bi_kpi_published",
  "ai_prediction_generated",
  "ai_fraud_alert",
  "ai_model_deployed",
  "platform_maintenance_scheduled",
  "platform_flag_killed",
  "platform_announcement"
];

export function defaultNotificationTemplates() {
  return {
    contribution_received: {
      title: "Contribution Received",
      sms: "Smile Trust: GHS {{amount}} received from {{name}}. Receipt {{receiptNo}}. New balance GHS {{balance}}.",
      whatsapp: "Hi {{name}}, we received GHS {{amount}} today. Receipt {{receiptNo}}. Balance: GHS {{balance}}.",
      email: "Dear {{name}},\n\nYour contribution of GHS {{amount}} has been received.\nReceipt: {{receiptNo}}\nBalance: GHS {{balance}}\n\nSmile Trust Susu."
    },
    withdrawal_approved: {
      title: "Withdrawal Approved",
      sms: "Smile Trust: Withdrawal of GHS {{amount}} for {{name}} has been approved.",
      whatsapp: "Hi {{name}}, your withdrawal of GHS {{amount}} is approved and will be paid shortly.",
      email: "Dear {{name}},\n\nYour withdrawal of GHS {{amount}} has been approved.\n\nSmile Trust Susu."
    },
    withdrawal_requested: {
      title: "Withdrawal Requested",
      sms: "Smile Trust: Withdrawal request of GHS {{amount}} for {{name}} has been received.",
      whatsapp: "Hi {{name}}, we received your withdrawal request of GHS {{amount}}.",
      email: "Dear {{name}},\n\nYour withdrawal request of GHS {{amount}} has been received.\n\nSmile Trust Susu."
    },
    withdrawal_rejected: {
      title: "Withdrawal Rejected",
      sms: "Smile Trust: Withdrawal of GHS {{amount}} for {{name}} was not approved.",
      whatsapp: "Hi {{name}}, your withdrawal of GHS {{amount}} was not approved.",
      email: "Dear {{name}},\n\nYour withdrawal of GHS {{amount}} was not approved.\n\nSmile Trust Susu."
    },
    withdrawal_paid: {
      title: "Withdrawal Paid",
      sms: "Smile Trust: GHS {{amount}} paid to {{name}}. Receipt {{receiptNo}}.",
      whatsapp: "Hi {{name}}, your withdrawal of GHS {{amount}} has been paid. Receipt {{receiptNo}}.",
      email: "Dear {{name}},\n\nYour withdrawal of GHS {{amount}} has been paid.\nReceipt: {{receiptNo}}\n\nSmile Trust Susu."
    },
    withdrawal_reversed: {
      title: "Withdrawal Reversed",
      sms: "Smile Trust: Withdrawal {{receiptNo}} for {{name}} was reversed.",
      whatsapp: "Hi {{name}}, withdrawal {{receiptNo}} was reversed.",
      email: "Dear {{name}},\n\nWithdrawal {{receiptNo}} was reversed.\n\nSmile Trust Susu."
    },
    savings_matured: {
      title: "Fixed Savings Matured",
      sms: "Smile Trust: A savings account for {{name}} has matured. Net payable GHS {{amount}}.",
      whatsapp: "Hi {{name}}, your savings have matured. Net payable GHS {{amount}}.",
      email: "Dear {{name}},\n\nYour savings have matured. Net payable GHS {{amount}}.\n\nSmile Trust Susu."
    },
    loan_due: {
      title: "Loan Due",
      sms: "Smile Trust: Loan installment of GHS {{amount}} is due on {{dueDate}} for {{name}}.",
      whatsapp: "Reminder: {{name}}, loan installment GHS {{amount}} is due {{dueDate}}.",
      email: "Dear {{name}},\n\nYour loan installment of GHS {{amount}} is due on {{dueDate}}.\n\nSmile Trust Susu."
    },
    meeting_reminder: {
      title: "Meeting Reminder",
      sms: "Smile Trust: {{groupName}} meets on {{meetingDay}}. Please attend with your contribution.",
      whatsapp: "{{groupName}} meeting reminder: {{meetingDay}}. See you there.",
      email: "Dear member,\n\n{{groupName}} will meet on {{meetingDay}}.\n\nSmile Trust Susu."
    },
    missed_contribution: {
      title: "Missed Contribution",
      sms: "Smile Trust: {{name}} missed a contribution on {{date}}. Please regularize with your agent.",
      whatsapp: "Hi {{name}}, we did not receive your contribution on {{date}}. Kindly pay your agent.",
      email: "Dear {{name}},\n\nA contribution was missed on {{date}}.\n\nSmile Trust Susu."
    },
    birthday_wishes: {
      title: "Birthday Wishes",
      sms: "Smile Trust wishes {{name}} a happy birthday! Thank you for saving with us.",
      whatsapp: "Happy birthday {{name}}! From all of us at Smile Trust.",
      email: "Dear {{name}},\n\nHappy birthday from Smile Trust Susu.\n\nWe appreciate you."
    },
    loan_disbursed: {
      title: "Loan Disbursed",
      sms: "Smile Trust: Loan of GHS {{amount}} has been disbursed to {{name}}.",
      whatsapp: "Hi {{name}}, your loan of GHS {{amount}} has been disbursed.",
      email: "Dear {{name}},\n\nYour loan of GHS {{amount}} has been disbursed.\n\nSmile Trust Susu."
    },
    handover_submitted: {
      title: "Cash Handover Submitted",
      sms: "Smile Trust: {{agentName}} submitted cash handover of GHS {{amount}} for {{date}}.",
      whatsapp: "Handover submitted by {{agentName}} — GHS {{amount}} on {{date}}.",
      email: "A cash handover of GHS {{amount}} was submitted by {{agentName}} for {{date}}."
    },
    large_deposit_alert: {
      title: "Large Deposit Alert",
      sms: "Smile Trust: Large deposit of GHS {{amount}} from {{name}}. Receipt {{receiptNo}}.",
      whatsapp: "Large deposit alert: {{name}} paid GHS {{amount}}. Receipt {{receiptNo}}.",
      email: "A large deposit of GHS {{amount}} was recorded for {{name}}. Receipt {{receiptNo}}."
    },
    target_achieved: {
      title: "Collection Target Achieved",
      sms: "Smile Trust: {{agentName}} reached today's collection target.",
      whatsapp: "{{agentName}} has achieved today's collection target.",
      email: "{{agentName}} has achieved today's collection target."
    },
    sync_complete: {
      title: "Synchronization Complete",
      sms: "Smile Trust: Offline collections have synchronized.",
      whatsapp: "Offline collections have synchronized.",
      email: "Offline collections have synchronized."
    },
    receipt_generated: {
      title: "Receipt Generated",
      sms: "Smile Trust: Receipt {{receiptNo}} for GHS {{amount}} issued to {{name}}.",
      whatsapp: "Receipt {{receiptNo}} issued to {{name}} for GHS {{amount}}.",
      email: "Receipt {{receiptNo}} was generated for {{name}} — GHS {{amount}}."
    },
    duplicate_attempt: {
      title: "Duplicate Collection Attempt",
      sms: "Smile Trust: Duplicate collection attempt for {{name}} on {{date}}.",
      whatsapp: "Duplicate collection attempt recorded for {{name}} on {{date}}.",
      email: "A duplicate collection was attempted for {{name}} on {{date}}."
    }
  };
}

export const EXTRA_NOTIFICATION_TEMPLATES = {
  customer_registered: {
    title: "Customer Registered",
    sms: "Smile Trust: Welcome {{name}}. Login: Account {{accountNo}} / PIN {{portalPin}}.",
    whatsapp: "Welcome {{name}}. Login with account {{accountNo}} and PIN {{portalPin}}.",
    email: "Dear {{name}},\n\nYour Smile Trust account {{accountNo}} is ready.\nLogin PIN: {{portalPin}} (last 4 digits of your phone).\nMember ID: {{customerNumber}}.\n\nSmile Trust Susu."
  },
  customer_verified: {
    title: "Customer Verified",
    sms: "Smile Trust: {{name}}, your KYC has been verified.",
    whatsapp: "Hi {{name}}, your KYC is verified.",
    email: "Dear {{name}},\n\nYour KYC has been verified.\n\nSmile Trust Susu."
  },
  customer_suspended: {
    title: "Customer Suspended",
    sms: "Smile Trust: Account for {{name}} is suspended.",
    whatsapp: "Hi {{name}}, your account is suspended. Contact your agent.",
    email: "Dear {{name}},\n\nYour account has been suspended.\n\nSmile Trust Susu."
  },
  customer_reactivated: {
    title: "Customer Reactivated",
    sms: "Smile Trust: Account for {{name}} is active again.",
    whatsapp: "Hi {{name}}, your account is active again.",
    email: "Dear {{name}},\n\nYour account has been reactivated.\n\nSmile Trust Susu."
  },
  loan_submitted: {
    title: "Loan Submitted",
    sms: "Smile Trust: Loan request for {{name}} has been submitted.",
    whatsapp: "Hi {{name}}, your loan request was submitted.",
    email: "Dear {{name}},\n\nYour loan request has been submitted.\n\nSmile Trust Susu."
  },
  loan_approved: {
    title: "Loan Approved",
    sms: "Smile Trust: Loan for {{name}} has been approved.",
    whatsapp: "Hi {{name}}, your loan is approved.",
    email: "Dear {{name}},\n\nYour loan has been approved.\n\nSmile Trust Susu."
  },
  loan_rejected: {
    title: "Loan Rejected",
    sms: "Smile Trust: Loan for {{name}} was not approved.",
    whatsapp: "Hi {{name}}, your loan was not approved.",
    email: "Dear {{name}},\n\nYour loan was not approved.\n\nSmile Trust Susu."
  },
  loan_completed: {
    title: "Loan Completed",
    sms: "Smile Trust: Loan for {{name}} is fully paid.",
    whatsapp: "Hi {{name}}, your loan is fully paid. Thank you.",
    email: "Dear {{name}},\n\nYour loan is fully paid.\n\nSmile Trust Susu."
  },
  loan_default: {
    title: "Loan Default",
    sms: "Smile Trust: Loan for {{name}} is in default. Please contact your branch.",
    whatsapp: "Hi {{name}}, your loan is in default. Please contact your branch.",
    email: "Dear {{name}},\n\nYour loan is in default.\n\nSmile Trust Susu."
  },
  missed_repayment: {
    title: "Missed Repayment",
    sms: "Smile Trust: {{name}} missed a loan repayment on {{date}}.",
    whatsapp: "Hi {{name}}, a loan repayment was missed on {{date}}.",
    email: "Dear {{name}},\n\nA loan repayment was missed on {{date}}.\n\nSmile Trust Susu."
  },
  shareout_announcement: {
    title: "Share-Out Announcement",
    sms: "Smile Trust: {{groupName}} share-out is {{date}}.",
    whatsapp: "{{groupName}} share-out is on {{date}}.",
    email: "{{groupName}} share-out is scheduled for {{date}}."
  },
  fine_issued: {
    title: "Fine Issued",
    sms: "Smile Trust: A fine of GHS {{amount}} was recorded for {{name}}.",
    whatsapp: "Hi {{name}}, a fine of GHS {{amount}} was recorded.",
    email: "Dear {{name}},\n\nA fine of GHS {{amount}} was recorded.\n\nSmile Trust Susu."
  },
  login_alert: {
    title: "Login Alert",
    sms: "Smile Trust: New sign-in for {{name}}.",
    whatsapp: "New Smile Trust sign-in recorded.",
    email: "A new sign-in was recorded for your Smile Trust account."
  },
  password_changed: {
    title: "Password Changed",
    sms: "Smile Trust: Password changed for {{name}}.",
    whatsapp: "Your Smile Trust password was changed.",
    email: "Your Smile Trust password was changed. If this was not you, contact support."
  },
  backup_completed: {
    title: "Backup Completed",
    sms: "Smile Trust: Backup completed.",
    whatsapp: "Backup completed.",
    email: "A system backup completed successfully."
  },
  sync_failed: {
    title: "Synchronization Failed",
    sms: "Smile Trust: Cloud sync failed. Data remains on this device.",
    whatsapp: "Cloud sync failed. Local data is unchanged.",
    email: "Cloud synchronization failed. Financial records on this device were not rolled back."
  },
  payment_completed: {
    title: "Payment Completed",
    sms: "Smile Trust: Payment of GHS {{amount}} completed. Ref {{receiptNo}}.",
    whatsapp: "Payment of GHS {{amount}} completed. Ref {{receiptNo}}.",
    email: "A payment of GHS {{amount}} completed. Reference {{receiptNo}}."
  },
  payment_failed: {
    title: "Payment Failed",
    sms: "Smile Trust: Payment of GHS {{amount}} failed. Ref {{receiptNo}}.",
    whatsapp: "Payment of GHS {{amount}} could not be confirmed. Ref {{receiptNo}}.",
    email: "A payment of GHS {{amount}} failed. Reference {{receiptNo}}."
  },
  payment_refunded: {
    title: "Payment Refunded",
    sms: "Smile Trust: Refund of GHS {{amount}} recorded. Ref {{receiptNo}}.",
    whatsapp: "Refund of GHS {{amount}} recorded for {{receiptNo}}.",
    email: "A refund of GHS {{amount}} was recorded. Reference {{receiptNo}}."
  },
  document_ready: {
    title: "Document Ready",
    sms: "Smile Trust: Your document {{receiptNo}} is ready.",
    whatsapp: "Your Smile Trust document {{receiptNo}} is ready.",
    email: "Your document {{receiptNo}} is available to download or print."
  },
  workflow_task_assigned: {
    title: "Workflow Task Assigned",
    sms: "Smile Trust: A workflow task was assigned to {{name}}.",
    whatsapp: "A Smile Trust workflow task is waiting for {{name}}.",
    email: "A workflow task has been assigned."
  },
  workflow_approval_request: {
    title: "Approval Requested",
    sms: "Smile Trust: Approval is required from {{name}}.",
    whatsapp: "Approval is required in Smile Trust.",
    email: "A workflow approval is waiting."
  },
  workflow_sla_warning: {
    title: "Workflow SLA Warning",
    sms: "Smile Trust: A workflow is approaching its SLA.",
    whatsapp: "A workflow SLA warning was raised.",
    email: "A workflow is approaching its due time."
  },
  workflow_sla_breach: {
    title: "Workflow SLA Breach",
    sms: "Smile Trust: A workflow SLA was breached.",
    whatsapp: "A workflow SLA was breached.",
    email: "A workflow SLA was breached."
  },
  workflow_completed: {
    title: "Workflow Completed",
    sms: "Smile Trust: A workflow completed for {{name}}.",
    whatsapp: "A Smile Trust workflow completed.",
    email: "A workflow completed successfully."
  },
  workflow_failed: {
    title: "Workflow Failed",
    sms: "Smile Trust: A workflow failed.",
    whatsapp: "A Smile Trust workflow failed.",
    email: "A workflow failed and may be retried."
  },
  workflow_escalation: {
    title: "Workflow Escalated",
    sms: "Smile Trust: A workflow task was escalated.",
    whatsapp: "A workflow task was escalated.",
    email: "A workflow task was escalated."
  },
  workflow_case_updated: {
    title: "Case Updated",
    sms: "Smile Trust: A business case was updated.",
    whatsapp: "A business case was updated.",
    email: "A business case was updated."
  },
  rule_published: {
    title: "Rule Published",
    sms: "Smile Trust: A business rule was published.",
    whatsapp: "A Smile Trust business rule was published.",
    email: "A business rule was published after testing and approval."
  },
  rule_failed: {
    title: "Rule Evaluation Failed",
    sms: "Smile Trust: A business rule evaluation failed.",
    whatsapp: "A business rule evaluation failed.",
    email: "A business rule evaluation failed."
  },
  rule_approval_request: {
    title: "Rule Approval Required",
    sms: "Smile Trust: A business rule is waiting for approval.",
    whatsapp: "A business rule needs approval.",
    email: "A business rule is waiting for maker-checker approval."
  },
  exchange_import_completed: {
    title: "Import Completed",
    sms: "Smile Trust: A data import finished ({{count}} records).",
    whatsapp: "A Smile Trust data import finished.",
    email: "A data import finished. Review the import history for details."
  },
  exchange_export_completed: {
    title: "Export Completed",
    sms: "Smile Trust: Export of {{dataset}} is ready.",
    whatsapp: "Your Smile Trust export is ready.",
    email: "Your requested export is ready. This action was audited."
  },
  exchange_export_approval: {
    title: "Export Approval Required",
    sms: "Smile Trust: An export of {{dataset}} needs approval.",
    whatsapp: "An export needs maker-checker approval.",
    email: "A sensitive export is waiting for maker-checker approval."
  },
  records_uploaded: {
    title: "Document Uploaded",
    sms: "Smile Trust: A digital record ({{type}}) was uploaded.",
    whatsapp: "A digital record was uploaded to Smile Trust.",
    email: "A digital record was uploaded and indexed in the records library."
  },
  records_archived: {
    title: "Document Archived",
    sms: "Smile Trust: A digital record was archived.",
    whatsapp: "A digital record was archived.",
    email: "A digital record was archived under the retention policy."
  },
  records_hold: {
    title: "Legal Hold Placed",
    sms: "Smile Trust: A legal hold was placed on a digital record.",
    whatsapp: "A legal hold was placed on a digital record.",
    email: "A legal hold was placed. The record cannot be deleted until released."
  },
  bi_kpi_published: {
    title: "KPI Published",
    sms: "Smile Trust: KPI {{kpi}} was published.",
    whatsapp: "A Smile Trust KPI was published.",
    email: "A KPI definition was published to the enterprise registry."
  },
  ai_prediction_generated: {
    title: "AI Prediction Generated",
    sms: "Smile Trust: Advisory AI prediction {{target}} generated.",
    whatsapp: "An advisory AI prediction was generated.",
    email: "An advisory AI prediction was generated. Rule Engine remains authoritative for deterministic decisions."
  },
  ai_fraud_alert: {
    title: "AI Fraud Alert",
    sms: "Smile Trust: {{count}} AI fraud alert(s) — advisory only.",
    whatsapp: "AI fraud alerts were raised (advisory; no ledger mutation).",
    email: "AI fraud detection produced advisory alerts. No ledger entries were posted."
  },
  ai_model_deployed: {
    title: "AI Model Deployed",
    sms: "Smile Trust: AI model {{modelVersionId}} deployed.",
    whatsapp: "An approved AI model was deployed to production.",
    email: "An approved AI model version was deployed after governance approval."
  },
  platform_maintenance_scheduled: {
    title: "Maintenance Scheduled",
    sms: "Smile Trust: Maintenance window {{title}} scheduled.",
    whatsapp: "A platform maintenance window was scheduled.",
    email: "Platform maintenance was scheduled. Mutating platform ops may be read-only during the window."
  },
  platform_flag_killed: {
    title: "Feature Flag Kill Switch",
    sms: "Smile Trust: Feature flag {{flagId}} emergency-disabled.",
    whatsapp: "A feature flag kill switch was activated.",
    email: "An emergency feature flag kill switch was activated by platform administration."
  },
  platform_announcement: {
    title: "Platform Announcement",
    sms: "Smile Trust: {{title}}",
    whatsapp: "{{title}} — {{body}}",
    email: "{{title}}\n\n{{body}}\n\nSmile Trust Platform Administration."
  }
};

export function allNotificationTemplates(state = {}) {
  return { ...defaultNotificationTemplates(), ...EXTRA_NOTIFICATION_TEMPLATES, ...(state.notificationTemplates || {}) };
}

export function interpolateTemplate(template, vars = {}) {
  const map = {
    ...vars,
    customer_name: vars.customer_name ?? vars.name,
    name: vars.name ?? vars.customer_name,
    transaction_number: vars.transaction_number ?? vars.receiptNo,
    loan_number: vars.loan_number ?? vars.loanNo,
    branch_name: vars.branch_name ?? vars.branchName,
    agent_name: vars.agent_name ?? vars.agentName
  };
  return String(template || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => String(map[key] ?? ""));
}

export function defaultCommunicationPrefs() {
  return {
    language: "en",
    preferredChannel: "SMS",
    sms: true,
    email: true,
    whatsapp: true,
    push: true,
    promotions: false
  };
}

export function customerAllowsChannel(prefs = {}, channel = "In-App") {
  const merged = { ...defaultCommunicationPrefs(), ...prefs };
  if (channel === "In-App") return true;
  if (channel === "SMS") return merged.sms !== false;
  if (channel === "Email") return merged.email !== false;
  if (channel === "WhatsApp") return merged.whatsapp !== false;
  if (channel === "Push") return merged.push !== false;
  return true;
}

export function queueNotification(state, {
  event,
  channel = "In-App",
  customerId = "",
  userId = "",
  vars = {},
  uid,
  idempotencyKey = "",
  correlationId = "",
  committed = true
}) {
  if (!committed) return { error: "Notifications are queued only after the related action is committed" };
  const templates = allNotificationTemplates(state);
  const template = templates[event];
  if (!template) return { error: "Unknown notification event" };
  const key = String(idempotencyKey || "").trim();
  if (key) {
    const existing = (state.notifications || []).find((item) => item.idempotencyKey === key);
    if (existing) {
      recordDuplicateHit(state, {
        idempotencyKey: key,
        source: "notification",
        resolution: "Original Returned",
        originalTransactionId: existing.id,
        correlationId: existing.correlationId
      });
      return { notification: existing, duplicate: true };
    }
  }
  const prefs = (state.notificationPreferences || []).find((item) => item.customerId === customerId)
    || (state.customers || []).find((item) => item.id === customerId)?.notificationPrefs;
  if (customerId && !customerAllowsChannel(prefs, channel)) {
    return { skipped: true, reason: "preference" };
  }
  const bodyKey = channel === "SMS" ? "sms" : channel === "WhatsApp" ? "whatsapp" : channel === "Email" ? "email" : "sms";
  const body = interpolateTemplate(template[bodyKey] || template.sms, vars);
  const item = {
    id: uid("ntf"),
    messageId: uid("msg"),
    correlationId: correlationId || uid("cor"),
    idempotencyKey: key,
    event,
    channel,
    title: template.title,
    body,
    customerId,
    userId,
    status: "Queued",
    failoverState: "Queued",
    validationStatus: "Passed",
    approvalStatus: "Not Required",
    retryCount: 0,
    providerId: "",
    createdAt: new Date().toISOString(),
    read: false,
    deleted: false,
    archived: false
  };
  state.notifications = state.notifications || [];
  state.notifications.push(item);
  return { notification: item };
}

export function unreadNotifications(state, { customerId = "", userId = "" } = {}) {
  return (state.notifications || []).filter((item) => {
    if (item.read || item.deleted || item.archived) return false;
    if (customerId && item.customerId !== customerId) return false;
    if (userId && item.userId !== userId) return false;
    return true;
  });
}

export function markNotificationRead(notification) {
  notification.read = true;
  notification.readAt = new Date().toISOString();
  return notification;
}

export function archiveNotification(notification) {
  notification.archived = true;
  notification.archivedAt = new Date().toISOString();
  return notification;
}

export function softDeleteNotification(notification) {
  notification.deleted = true;
  notification.deletedAt = new Date().toISOString();
  notification.archived = true;
  return notification;
}

export function birthdayCustomers(customers = [], date) {
  const md = String(date || "").slice(5, 10);
  if (!md) return [];
  return customers.filter((customer) => String(customer.dateOfBirth || "").slice(5, 10) === md);
}
