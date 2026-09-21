# Module 23 — Workflow Engine, Business Process Automation & Case Management

The Workflow Engine is the **central orchestration** service for approvals, tasks, cases, SLAs, and escalations. It does **not** post collections, change loan interest **15%**, the 31-day cycle, cashier GHS **1,000**, or `customerBalance`. Live withdrawals, loans, and collections stay on their owning screens and engines.

## What it does

- Executes versioned workflow definitions (sequential, parallel, conditional, event-driven, human, and automated).
- Routes tasks with assignment, delegation, escalation, suspension, and completion.
- Enforces configurable approvals: single, dual (maker-checker), majority, unanimous, automatic, and automatic rejection.
- Tracks SLA warning/breach and escalates through Module 19 plus Module 12 notifications.
- Manages business cases (fraud, complaints, disputes, exceptions) with participants, documents, and a timeline.
- Starts from the UI, contracts, the in-process gateway, scheduler ticks, or domain events.

Business rules (risk scores, loan eligibility, payment posting) remain owned by Modules 1–22. This engine only orchestrates.

## State machine

`draft → created → ready → running → waiting → completed`

Also: `running ↔ suspended`, `running → failed → retrying → completed|failed`, `running → cancelled`.

Running instances keep the definition version they started with unless an approved migration is applied.

## UI

Extras sit under the existing **Audit Log** (inbox, start, SLA tick, cases). Reports extras export CSV. No new nav item.

## Implementation

- Lifecycle: `src/core/workflow-lifecycle.js`
- Engine: `src/core/workflow-ops.js`
- Public contracts: `src/core/workflow-api.js`
- Extras: `src/ui/workflow-views.js`
- Schema: `supabase/migrations/035_workflow_engine.sql`, `supabase/migrations/036_workflow_contracts.sql`
- Tests: `tests/workflow-ops.test.js`, `tests/workflow-contracts.test.js`

There is no REST or GraphQL HTTP server. Gateway routes are in-process contracts published as `/api/v1/workflows` (and related paths) through Module 20.

# Concrete Workflow API Contracts & Public Service Interfaces

These contracts are the only approved interfaces through which other modules may create, execute, manage, or query workflow instances. No module shall directly manipulate workflow runtime state or database tables.

## Design principles

The engine exposes versioned APIs, stable request/response schemas, idempotent commands where retries are possible, read-only queries, immutable domain events, and complete audit integration. All contracts comply with the Global API Contract Specification.

## Command contracts

| Contract | Purpose | Request | Success | Event |
|----------|---------|---------|---------|-------|
| `Workflow.Start.v1` | Create and start an instance | `workflowDefinitionId`, `workflowVersion`, `businessEntityType`, `businessEntityId`, `initiatedBy`, `priority`, `initialVariables`, `correlationId` | `workflowInstanceId`, `initialState`, `createdTimestamp`, `acceptedTasks` | `WorkflowStarted` |
| `Workflow.Resume.v1` | Resume a suspended instance | `workflowInstanceId`, `resumedBy`, `reason` | `workflowInstanceId`, `currentState` | `WorkflowResumed` |
| `Workflow.Suspend.v1` | Suspend an executing instance | `workflowInstanceId`, `suspendedBy`, `reason` | `workflowInstanceId`, `suspensionTimestamp` | `WorkflowSuspended` |
| `Workflow.Cancel.v1` | Cancel an active instance | `workflowInstanceId`, `cancelledBy`, `cancellationReason` | `workflowInstanceId`, `finalState` | `WorkflowCancelled` |
| `Workflow.Retry.v1` | Retry a failed instance | `workflowInstanceId`, `retryReason` | `retryAttempt`, `workflowState` | `WorkflowRetried` |
| `Workflow.CompleteTask.v1` | Complete a human or automated task | `workflowTaskId`, `completedBy`, `outcome`, `taskData` | `taskStatus`, `nextState`, `nextTasks` | `WorkflowTaskCompleted` |
| `Workflow.AssignTask.v1` | Assign a task | `workflowTaskId`, `assigneeType`, `assigneeId`, `assignedBy` | `assignmentId` | `WorkflowTaskAssigned` |
| `Workflow.DelegateTask.v1` | Delegate an assigned task | `workflowTaskId`, `delegatedTo`, `delegationReason` | `delegationId` | `WorkflowTaskDelegated` |
| `Workflow.Approve.v1` | Record an approval | `workflowTaskId`, `approvalDecision`, `approvalComment` | `workflowState`, `approvalStatus` | `WorkflowApproved` |
| `Workflow.Reject.v1` | Reject an approval step | `workflowTaskId`, `rejectionReason` | `workflowState`, `rejectionStatus` | `WorkflowRejected` |

`Task.Complete.v1` remains as a compatible alias of `Workflow.CompleteTask.v1`. Legacy `{ code, subjectId }` start payloads still work.

## Query contracts

- `Workflow.Get.v1` / `Workflow.Status.v1` — instance, definition, current state, variables, timestamps, linked business entity
- `Workflow.List.v1` — pagination, filtering, sorting, status, owner, branch, priority, SLA state
- `Workflow.Tasks.v1` — active, completed, and pending tasks
- `Workflow.Case.v1` / `Case.Get.v1` — case details, participants, documents, related entities, timeline
- `Workflow.History.v1` — execution history, transitions, approvals, escalations, retries, audit references
- `Workflow.Definitions.v1`, `Workflow.Definition.Get.v1`, `Workflow.Statistics.v1`

## Event contracts

Minimum published events: `WorkflowStarted`, `WorkflowCompleted`, `WorkflowFailed`, `WorkflowCancelled`, `WorkflowSuspended`, `WorkflowResumed`, `WorkflowEscalated`, `WorkflowExpired`, `WorkflowRetried`, `WorkflowTaskCreated`, `WorkflowTaskAssigned`, `WorkflowTaskCompleted`, `WorkflowTaskDelegated`, `WorkflowApproved`, `WorkflowRejected`, `WorkflowSLABreached`, `WorkflowCaseOpened`, `WorkflowCaseClosed`. Legacy `TaskAssigned`, `TaskEscalated`, and `CaseOpened` remain for compatibility. Events follow the Global Event Schema Specification.

## Callback contracts

Modules may register callback endpoints (`Workflow.RegisterCallback.v1`) for completion, approval, assignment, escalation, SLA breach, and failure. Deliveries are recorded through the in-process API Gateway / webhook framework. There is no outbound HTTP listener.

## Standard error codes

| Code | Meaning |
|------|---------|
| WF-001 | Workflow Definition Not Found |
| WF-002 | Workflow Version Unsupported |
| WF-003 | Invalid Workflow State |
| WF-004 | Task Not Found |
| WF-005 | Unauthorized Task Action |
| WF-006 | SLA Expired |
| WF-007 | Duplicate Workflow Request |
| WF-008 | Invalid Transition |
| WF-009 | Workflow Already Completed |
| WF-010 | Concurrency Conflict |

Additional module-specific codes may be defined but shall not change the meaning of these codes.

## Security and versioning

Every contract enforces authentication, authorization, role validation, branch restrictions, ownership validation, delegation rules, idempotency where applicable, and audit logging. No contract bypasses the centralized engine. Breaking changes require a new major version. Deprecated versions remain supported under the platform deprecation policy. `Workflow.Create` on HTTP routes maps to `Workflow.Start`.

# Concrete HTTP Endpoint Specification for Workflow API Contracts

Canonical in-process gateway paths (published as `/api/v1/...` conceptually; v2 may coexist):

| Method | Path | Contract |
|--------|------|----------|
| POST | `/api/v1/workflows` | `Workflow.Start.v1` |
| GET | `/api/v1/workflows/{workflowInstanceId}` | `Workflow.Get.v1` |
| GET | `/api/v1/workflows` | `Workflow.List.v1` |
| POST | `/api/v1/workflows/{id}/suspend` | `Workflow.Suspend.v1` |
| POST | `/api/v1/workflows/{id}/resume` | `Workflow.Resume.v1` |
| POST | `/api/v1/workflows/{id}/cancel` | `Workflow.Cancel.v1` |
| POST | `/api/v1/workflows/{id}/retry` | `Workflow.Retry.v1` |
| GET | `/api/v1/workflows/{id}/tasks` | `Workflow.Tasks.v1` |
| POST | `/api/v1/tasks/{taskId}/complete` | `Workflow.CompleteTask.v1` |
| POST | `/api/v1/tasks/{taskId}/assign` | `Workflow.AssignTask.v1` |
| POST | `/api/v1/tasks/{taskId}/delegate` | `Workflow.DelegateTask.v1` |
| POST | `/api/v1/tasks/{taskId}/approve` | `Workflow.Approve.v1` |
| POST | `/api/v1/tasks/{taskId}/reject` | `Workflow.Reject.v1` |
| POST | `/api/v1/cases` | `Case.Open.v1` |
| GET | `/api/v1/cases/{caseId}` | `Workflow.Case.v1` |
| GET | `/api/v1/cases` | collection query |
| POST | `/api/v1/cases/{caseId}/close` | `Case.Close.v1` |
| GET | `/api/v1/workflow-definitions` | `Workflow.Definitions.v1` |
| GET | `/api/v1/workflow-definitions/{id}` | `Workflow.Definition.Get.v1` |
| POST | `/api/v1/workflow-definitions/{id}/publish` | `Workflow.PublishDefinition.v1` |
| POST | `/api/v1/workflow-definitions/{id}/retire` | `Workflow.RetireDefinition.v1` |
| GET | `/api/v1/workflows/statistics` | `Workflow.Statistics.v1` |
| POST | `/api/v1/workflows/{id}/replay` | `Workflow.Replay.v1` |

Legacy routes `POST /workflows/start`, `POST /workflows/status`, and `POST /workflows/inbox` remain. No internal service endpoint is exposed to external HTTP clients.

HTTP status usage: 200 query/command completion, 201 created, 202 accepted, 204 no content, 400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict / invalid state / duplicate / concurrency, 412 precondition, 416 page out of range, 422 business rule, 429 rate limit, 415 unsupported media type, 500 unexpected, 503 unavailable.

State-changing requests include the standard request header, correlation ID, request ID, and an idempotency key where required. Duplicate keys return the original success without executing the action again. Media type is `application/json` with UTF-8. GET responses may include cache directives; POST is not cached; sensitive workflow state uses `Cache-Control: no-store`.

# Concrete HTTP Response Schema Specification for Workflow Endpoints

Every success body uses the platform envelope `{ header, status, data, links, warnings }`. `data` is endpoint-specific and must not add, remove, or rename documented properties without a new major version. Collection endpoints add canonical `pagination`. State-changing commands return previous and resulting state where applicable.

Examples (field names are normative):

- POST `/workflows` → `workflowInstanceId`, `workflowDefinitionId`, `workflowVersion`, `state`, `priority`, `businessEntityType`, `businessEntityId`, `startedAtUtc`, `startedBy`, `activeTaskCount`
- GET `/workflows/{id}` → metadata, `currentState`, `variables`, `activeTasks`, `completedTasks`, `timeline`
- POST suspend/resume/cancel/retry → `workflowInstanceId`, `previousState`, `currentState`, actor and timestamp
- POST task complete/assign/delegate/approve/reject → task identifiers plus outcome or assignment/delegation identifiers
- POST `/cases` → `caseId`, `caseNumber`, `status`, `createdAtUtc`, `ownerUserId`
- GET statistics → `running`, `waiting`, `completed`, `failed`, `cancelled`, `slaBreaches`, `escalations`, `averageExecutionTimeMs`
- POST replay → `originalWorkflowInstanceId`, `replayWorkflowInstanceId`, `replayStartedAtUtc`, `initiatedBy`

Errors use the standardized platform error envelope only: `errorCode`, `category`, `message`, `details`, `retryable`, `correlationId`, `requestId`.

# Acceptance

The workflow API is complete only when every lifecycle operation is a documented public contract; commands, queries, callbacks, and events are separated; state changes occur only through published commands; contracts are authenticated, authorized, versioned, idempotent where appropriate, monitored, and audited; standard error codes are consistent; HTTP mappings, response schemas, pagination, and empty-page behavior are enforced; and automated tests cover compatibility, authorization, transitions, callbacks, events, concurrency, retries, delegation, approvals, and backward compatibility.
