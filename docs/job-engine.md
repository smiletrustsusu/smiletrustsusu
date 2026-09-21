# Module 18 — Background Jobs, Queue Management & Scheduler Engine

The scheduler is the **only** path for long-running, scheduled, retryable, or asynchronous work in Smile Trust. Collections, withdrawals, loans, payments, documents, and accounting still post money the same way. This engine **orchestrates** those workers. It does not post interest, close cash, or change the 31-day cycle.

There is no REST/GraphQL API. Live UI remains `app.js`. Existing Backup / Cloud Backup / ordered sync stay on the Backup screen. Scheduler extras sit **below** them. Cashier GHS **1,000**, loan interest **15%**, `customerBalance`, and the MoMo webhook secret field stay as they are.

## What the engine does

- Enqueues immediate, delayed, scheduled, priority, retry, batch, and dead-letter work.
- Reserves jobs to a worker with optimistic concurrency and aggregate locks.
- Retries with exponential, fixed, immediate, or manual backoff, reusing Correlation ID and Idempotency Key.
- Recovers reserved/running jobs after a worker crash.
- Honors dependency graphs (Daily Closing → Interest Posting → Trial Balance → Financial Reports).
- Exposes queue, worker, DLQ, calendar, and health extras without a new nav item.

Payment, document, notification, report, and sync queues remain the real workers. The scheduler calls `processPaymentQueue`, `processDocumentQueue`, and `processSyncQueue` (sync apply is skipped unless an `applyFn` is supplied, so live collections are never fake-applied).

## Job lifecycle

```text
Created → Queued → Reserved → Running → Completed
```

Terminal alternatives: Failed, Cancelled, Dead Letter, Expired. Invalid transitions are rejected. Every transition is audited.

## Queue ownership

| Queue | Owner | Backup owner |
|---|---|---|
| Immediate | Scheduler Engine | Application Controller |
| Delayed | Scheduler Engine | Process Orchestrator |
| Scheduled | Scheduler Engine | Workflow Engine |
| Priority | Scheduler Engine | Scheduler Recovery Service |
| Retry | Retry Engine | Job Recovery Service |
| Dead letter | Dead Letter Service | Operations Recovery Service |
| Batch | Batch Orchestrator | Batch Recovery Service |

Priorities: Critical, High, Normal, Low, Background. Critical work (accounting, payments, synchronization, audit persistence) is selected first so background jobs cannot starve it.

## Worker lifecycle and failover

Workers register, heartbeat, drain, and go unhealthy then offline if heartbeats stop (3× heartbeat interval). A draining or offline worker cannot reserve jobs. Stale reserved/running jobs are requeued after the lock TTL. Aggregate lock `JOB:{type}` allows only one worker to run a non-parallelizable type.

## Distributed locking

- Optimistic `version` on reserve.
- Queue row status follows the job.
- Non-parallel types take `acquireAggregateLock("JOB", type)`.
- Crash recovery releases the lock before another worker may continue.

## Retry and backoff

Configurable `maxAttempts`. Strategies: exponential (`base * 2^(attempt-1)`, capped), fixed, immediate (0 ms), manual (no auto retry). Exhausted jobs move to the DLQ with payload, failure reason, retry history, correlation ID, and queue history.

## Dependencies

Instance `dependsOn` plus type-level rules. A dependent job stays queued until every prerequisite is `completed`.

## Scheduler ordering

Each tick: recover stale work → skip blackout / execution window → enqueue due cron/calendar schedules → pick critical-ready jobs FIFO within priority → reserve → run. Cron expressions are five UTC fields and fire at most once per minute bucket.

## Dead letter replay

Replay is high-risk. Non-owners request maker-checker approval. Maker ≠ checker. System Owner / Super Admin may replay with reason. Replay requeues the **same** job (same Correlation ID and Idempotency Key). It does not create a second financial posting.

## Monitoring and health

Dashboard tracks queue depth, workers, processing/retry/failure, DLQ size, and a 0–100 health score (healthy ≥ 80, degraded ≥ 50, else unhealthy).

## Approvals

Maker-checker for DLQ replay, manual financial/accounting runs, and cancelling a running job. Collectors have no job administration. Auditors have `Job.View` only.

## Implementation

- Engine: `src/core/job-ops.js`, `src/core/job-lifecycle.js`
- Extras: `src/ui/job-views.js`
- Schema: `supabase/migrations/028_jobs.sql`

## Acceptance

- Asynchronous work is orchestrated through this engine.
- Lifecycle states are enforced and audited.
- Retries and DLQ replay work, including maker-checker.
- Distributed workers cannot complete the same non-parallel job twice.
- Dependencies are honored.
- Worker crashes requeue safely.
- Live SUSU/loan math is unchanged.

## Appendix — refinement sequence

1. **Job state transitions** — matrix in `job-lifecycle.js`; `transitionJob` is the only writer.
2. **Queue ownership** — `QUEUE_OWNERS` / `QUEUE_BACKUP_OWNERS`; retry and DLQ have exclusive owners.
3. **Worker lifecycle** — registered → healthy → degraded/unhealthy → draining/offline; heartbeats and drain.
4. **Distributed locking** — version + `JOB:{type}` aggregate lock; one non-parallel executor.
5. **Retry algorithms** — `nextRetryDelayMs`; correlation and idempotency reused.
6. **Dependency resolution** — instance graph plus type prerequisites; blocked jobs stay queued.
7. **Execution ordering** — critical first, then FIFO; blackout and windows pause ticks.
8. **DLQ replay** — retry exhaustion only; approved replay requeues the original job.
9. **Health scoring** — failure, retry, DLQ, stale workers, queue depth.
10. **Approvals** — replay, manual financial/accounting, cancel-running; Owner emergency override with audit.
