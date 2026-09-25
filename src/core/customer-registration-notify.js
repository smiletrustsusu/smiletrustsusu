/**
 * Welcome SMS on member registration — queues notification + outbound message.
 * Does not block registration; callers toast from the returned status.
 */

import { queueNotification, interpolateTemplate, allNotificationTemplates } from "./notifications.js";
import { portalPinFromPhone } from "./customer-portal.js";

export function isLiveSmsProviderConfigured(state = {}, runtime = {}) {
  if (runtime.KbaSmsGateway) return true;
  const settings = state.settings || {};
  if (settings.smsProviderConfigured === true) return true;
  if (String(settings.smsApiKey || settings.smsProviderApiKey || "").trim()) return true;
  const providers = state.notificationProviders || [];
  return providers.some((p) =>
    String(p.channel || "").toUpperCase() === "SMS"
    && p.enabled !== false
    && (p.apiKey || p.configured === true || p.live === true)
  );
}

export function buildCustomerRegistrationSmsBody(customer = {}, state = {}) {
  const templates = allNotificationTemplates(state);
  const template = templates.customer_registered || {};
  const memberId = customer.customerNumber || customer.accountNo || customer.id || "";
  const accountNo = customer.accountNo || memberId;
  const portalPin = customer.portalPin || portalPinFromPhone(customer.phone);
  const smsTemplate = String(template.sms || template.body || "").includes("{{portalPin}}")
    ? (template.sms || template.body)
    : "Smile Trust: Welcome {{name}}. Login: Account {{accountNo}} / PIN {{portalPin}}.";
  return interpolateTemplate(smsTemplate, {
    name: customer.name || "member",
    customerNumber: memberId,
    accountNo,
    portalPin
  });
}

/**
 * Queue welcome SMS for a newly registered customer.
 * Always records notification + messages row when phone present.
 * @returns {{ ok: boolean, status: string, toast: string, notification?: object, message?: object, error?: string }}
 */
export function enqueueCustomerRegistrationSms(state, customer, {
  uid = (prefix) => `${prefix}-${Date.now().toString(36)}`,
  runtime = typeof globalThis !== "undefined" ? globalThis : {},
  now = () => new Date().toISOString()
} = {}) {
  if (!state || !customer) {
    return { ok: false, status: "missing", toast: "SMS skipped", error: "missing customer" };
  }
  const phone = String(customer.phone || "").trim();
  if (!phone) {
    return { ok: false, status: "invalid_phone", toast: "SMS skipped — no phone number", error: "no phone" };
  }

  const body = buildCustomerRegistrationSmsBody(customer, state);
  const memberId = customer.customerNumber || customer.accountNo || customer.id || "";
  const accountNo = customer.accountNo || memberId;
  const portalPin = customer.portalPin || portalPinFromPhone(customer.phone);
  let notification = null;
  try {
    const queued = queueNotification(state, {
      event: "customer_registered",
      channel: "SMS",
      customerId: customer.id,
      vars: {
        name: customer.name || "member",
        customerNumber: memberId,
        accountNo,
        portalPin
      },
      uid,
      idempotencyKey: `customer-registered-sms:${customer.id}`,
      committed: true
    });
    notification = queued.notification || null;
    if (queued.error && !notification) {
      return { ok: false, status: "error", toast: "SMS failed to queue", error: queued.error, notification };
    }
  } catch (error) {
    return {
      ok: false,
      status: "error",
      toast: "SMS failed to queue",
      error: error?.message || String(error)
    };
  }

  state.messages = state.messages || [];
  const message = {
    id: uid("msg"),
    kind: "Registration",
    ref: customer.id,
    customerId: customer.id,
    phone,
    body,
    status: "Queued",
    date: String(now()).slice(0, 10),
    createdAt: now(),
    autoSend: true,
    notificationId: notification?.id || ""
  };
  state.messages.push(message);

  const live = isLiveSmsProviderConfigured(state, runtime);
  if (live && runtime.KbaSmsGateway?.sendSms) {
    try {
      const result = runtime.KbaSmsGateway.sendSms(phone, body);
      if (result === "SENT" || result === true) {
        message.status = "Sent";
        message.sentAt = now();
        if (notification) {
          notification.status = "Sent";
          notification.failoverState = "Delivered";
        }
        return { ok: true, status: "sent", toast: "SMS sent", notification, message };
      }
    } catch {
      /* fall through to queued */
    }
  }

  message.status = live ? "Queued for phone" : "Queued";
  if (notification && notification.status === "Queued") {
    notification.failoverState = notification.failoverState || "Queued";
  }

  return {
    ok: true,
    status: live ? "queued" : "queued_no_provider",
    toast: live ? "SMS queued" : "SMS queued (provider not configured)",
    notification,
    message
  };
}
