/**
 * Secure offline queue with idempotency keys.
 * Retried submissions must never create duplicate payments.
 */

export function enqueueOfflineOperation(state, operation) {
  state.offlineQueue = state.offlineQueue || [];
  const key = String(operation.idempotencyKey || "").toLowerCase();
  if (!key) throw new Error("Offline operation requires an idempotency key");
  if (state.offlineQueue.some((item) => String(item.idempotencyKey || "").toLowerCase() === key)) {
    return state.offlineQueue.find((item) => String(item.idempotencyKey || "").toLowerCase() === key);
  }
  const entry = {
    id: operation.id || `q-${Date.now()}`,
    kind: operation.kind,
    idempotencyKey: key,
    payload: operation.payload,
    status: operation.status || "pending",
    attempts: 0,
    createdAt: new Date().toISOString(),
    lastAttemptAt: "",
    localSequence: operation.localSequence,
    serverSequence: operation.serverSequence ?? null,
    correlationId: operation.correlationId || "",
    globalTransactionId: operation.globalTransactionId || operation.id || "",
    aggregateId: operation.aggregateId || "",
    primaryAggregateType: operation.primaryAggregateType || "",
    primaryAggregateId: operation.primaryAggregateId || "",
    primaryAggregateVersion: operation.primaryAggregateVersion || 1,
    secondaryAggregates: operation.secondaryAggregates || [],
    dependencies: operation.dependencies || [],
    dependsOn: operation.dependsOn || [],
    deviceId: operation.deviceId || "",
    agentId: operation.agentId || "",
    branchId: operation.branchId || "",
    businessDate: operation.businessDate || "",
    createdTimestamp: operation.createdTimestamp || new Date().toISOString(),
    payloadHash: operation.payloadHash || "",
    queuePosition: operation.queuePosition || operation.localSequence || 0,
    encrypted: Boolean(operation.encrypted),
    priority: operation.priority ?? null,
    nextRetryAt: operation.nextRetryAt || "",
    lastBackoffSeconds: operation.lastBackoffSeconds ?? null,
    failureClass: operation.failureClass || "",
    retryPolicyId: operation.retryPolicyId || ""
  };
  state.offlineQueue.push(entry);
  return entry;
}

export function markQueueApplied(state, idempotencyKey) {
  const key = String(idempotencyKey || "").toLowerCase();
  const entry = (state.offlineQueue || []).find((item) => String(item.idempotencyKey || "").toLowerCase() === key);
  if (entry) {
    entry.status = "applied";
    entry.appliedAt = new Date().toISOString();
  }
  return entry;
}

export function pendingQueueItems(state) {
  return (state.offlineQueue || []).filter((item) => item.status === "pending");
}

export function flushOfflineQueue(state, applyFn) {
  const results = [];
  pendingQueueItems(state).forEach((entry) => {
    entry.attempts += 1;
    entry.lastAttemptAt = new Date().toISOString();
    try {
      const applied = applyFn(entry);
      if (applied !== false) {
        entry.status = "applied";
        entry.appliedAt = new Date().toISOString();
        results.push({ id: entry.id, ok: true });
      }
    } catch (error) {
      entry.lastError = error.message || "Apply failed";
      results.push({ id: entry.id, ok: false, error: entry.lastError });
    }
  });
  return results;
}
