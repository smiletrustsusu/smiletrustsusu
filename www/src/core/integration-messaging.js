/**
 * Module 28 — In-memory message broker (pub/sub, P2P, DLQ, ordering, idempotency).
 */

import { MESSAGE_PATTERNS, MESSAGE_STATES, QUEUE_STATES } from "./integration-lifecycle.js";

export const MESSAGE_BROKER_VERSION = "1.0.0";

export function ensureMessageBrokerState(state = {}) {
  state.messageQueues = state.messageQueues || [];
  state.messageHistory = state.messageHistory || [];
  state.messageIdempotency = state.messageIdempotency || [];
  state.messageSubscriptions = state.messageSubscriptions || [];
  return state;
}

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

export function ensureQueue(state, name, options = {}, uid, now) {
  ensureMessageBrokerState(state);
  let queue = state.messageQueues.find((item) => item.name === name);
  if (queue) return queue;
  queue = {
    id: newId("q", uid),
    name,
    pattern: MESSAGE_PATTERNS.includes(options.pattern) ? options.pattern : "pubsub",
    status: "active",
    ordering: options.ordering !== false,
    maxDepth: Number(options.maxDepth || 1000),
    backPressure: false,
    depth: 0,
    createdAt: nowIso(now)
  };
  state.messageQueues.push(queue);
  return queue;
}

export function publishMessage(state, input = {}, uid, now) {
  ensureMessageBrokerState(state);
  const queue = ensureQueue(state, input.queue || input.queueName || "default", input, uid, now);
  if (queue.status === "paused" || queue.status === "retired") {
    return { ok: false, error: "Queue unavailable", errorCode: "INT-014", http: 409 };
  }
  if (queue.depth >= queue.maxDepth) {
    queue.backPressure = true;
    return { ok: false, error: "Queue back-pressure", errorCode: "INT-014", http: 429 };
  }
  const idempotencyKey = input.idempotencyKey || "";
  if (idempotencyKey) {
    const prior = state.messageIdempotency.find((item) => item.key === idempotencyKey && item.queue === queue.name);
    if (prior) {
      const existing = state.messageHistory.find((item) => item.id === prior.messageId);
      return { ok: true, replayed: true, message: existing };
    }
  }
  const message = {
    id: newId("msg", uid),
    queue: queue.name,
    pattern: queue.pattern,
    payload: input.payload ?? {},
    headers: input.headers || {},
    status: "queued",
    sequence: queue.depth + 1,
    createdAt: nowIso(now),
    ackedAt: null,
    attempts: 0
  };
  state.messageHistory.push(message);
  queue.depth += 1;
  queue.backPressure = queue.depth >= Math.floor(queue.maxDepth * 0.9);
  if (idempotencyKey) {
    state.messageIdempotency.push({ key: idempotencyKey, queue: queue.name, messageId: message.id, createdAt: message.createdAt });
  }
  return { ok: true, message, queue };
}

export function subscribe(state, input = {}, uid, now) {
  ensureMessageBrokerState(state);
  const queue = ensureQueue(state, input.queue || "default", input, uid, now);
  const sub = {
    id: newId("sub", uid),
    queue: queue.name,
    consumer: input.consumer || "anonymous",
    createdAt: nowIso(now)
  };
  state.messageSubscriptions.push(sub);
  return { ok: true, subscription: sub };
}

export function consumeNext(state, queueName, consumer = "anonymous", uid, now) {
  ensureMessageBrokerState(state);
  const queue = state.messageQueues.find((item) => item.name === queueName);
  if (!queue) return { ok: false, error: "Queue not found", errorCode: "INT-005", http: 404 };
  const pending = state.messageHistory
    .filter((item) => item.queue === queueName && item.status === "queued")
    .sort((a, b) => a.sequence - b.sequence);
  const message = pending[0];
  if (!message) return { ok: true, empty: true, message: null };
  message.status = "delivered";
  message.consumer = consumer;
  message.deliveredAt = nowIso(now);
  message.attempts += 1;
  return { ok: true, message };
}

export function ackMessage(state, messageId, now) {
  ensureMessageBrokerState(state);
  const message = state.messageHistory.find((item) => item.id === messageId);
  if (!message) return { ok: false, error: "Message not found", errorCode: "INT-005", http: 404 };
  message.status = "acked";
  message.ackedAt = nowIso(now);
  const queue = state.messageQueues.find((item) => item.name === message.queue);
  if (queue && queue.depth > 0) queue.depth -= 1;
  if (queue) queue.backPressure = queue.depth >= Math.floor(queue.maxDepth * 0.9);
  return { ok: true, message };
}

export function nackMessage(state, messageId, { deadLetter = false } = {}, now) {
  ensureMessageBrokerState(state);
  const message = state.messageHistory.find((item) => item.id === messageId);
  if (!message) return { ok: false, error: "Message not found", errorCode: "INT-005", http: 404 };
  if (deadLetter || message.attempts >= 3) {
    message.status = "dead_letter";
    message.deadLetteredAt = nowIso(now);
    const dlq = ensureQueue(state, `${message.queue}.dlq`, { pattern: "p2p" }, null, now);
    dlq.depth += 1;
  } else {
    message.status = "queued";
  }
  return { ok: true, message };
}

export function replayMessage(state, messageId, uid, now) {
  ensureMessageBrokerState(state);
  const original = state.messageHistory.find((item) => item.id === messageId);
  if (!original) return { ok: false, error: "Message not found", errorCode: "INT-005", http: 404 };
  const published = publishMessage(state, {
    queue: original.queue,
    payload: original.payload,
    headers: { ...original.headers, replayOf: original.id }
  }, uid, now);
  if (published.ok) {
    original.status = "replayed";
    published.message.status = "queued";
  }
  return published;
}

export function queueDepthReport(state) {
  ensureMessageBrokerState(state);
  return (state.messageQueues || []).map((queue) => ({
    name: queue.name,
    status: QUEUE_STATES.includes(queue.status) ? queue.status : queue.status,
    depth: queue.depth,
    backPressure: !!queue.backPressure,
    pattern: queue.pattern
  }));
}

export function assertMessagingBoundary() {
  return {
    inMemory: true,
    restHttp: false,
    postsCollections: false,
    supports: MESSAGE_STATES
  };
}
