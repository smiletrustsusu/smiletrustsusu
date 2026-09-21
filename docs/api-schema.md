# Global API Schema — Request, Response, Headers & Conditional Rules

This is the platform-wide message contract for the SMILE TRUST SUSU MANAGEMENT SYSTEM. It applies to Modules 1–24 and any future module. It is an **in-process** standard: there is no REST or GraphQL HTTP server, and it does not post collections or change `handleCollection`.

Implementation: `src/core/api-schema.js`, wired through `invokeContract` in `src/core/module-contracts.js`.

## Standard envelopes

Every public command, query, administrative, batch, health, webhook, and background request uses UTF-8 JSON with:

- A versioned **header**
- A standardized **status** (`SUCCESS`, `ACCEPTED`, `VALIDATION_ERROR`, …)
- Contract payload in **data** (or **job** / **document** / **pagination** when applicable)
- Correlation identifiers on success **and** failure

Financial amounts in schema payloads use decimal strings (`"20.00"`), never IEEE floating-point. Live collection storage is unchanged (GHS numbers / integer pesewas in core).

Trusted internal callers (no header, or `InternalService` / `Scheduler` / `BackgroundWorker`) receive gateway-assigned `requestId`, `correlationId`, and `traceId`. Existing `invokeContract({ contractId, fromModule, payload })` calls keep working and still return `ok` and `data`.

## Header model

The response header is a **superset** of the request header. Immutable request identifiers are copied exactly:

`requestId`, `correlationId`, `traceId`, `contractId`, `contractVersion`, `requestTimestampUtc`, plus client/user/device/branch/session identifiers when present.

Response-only fields: `responseId`, `responseTimestampUtc`, `processingDurationMs`, `serverNodeId`, `schemaVersion`, optional `responseSignature`.

Each property has two independent axes:

| Axis | Codes | Question |
|------|--------|----------|
| Requirement | `R` / `CR` / `O` | Must this field exist? |
| Generation | `CG` / `GG` / `SG` / `PG` / `RG` / `PR` | Who creates or copies it? |

Validation runs in two stages (requirement, then generation) **before** business logic.

## Conditional rules

Conditionally required fields (`deviceId`, `userId`, `sessionId`, `idempotencyKey`, `branchId`) are expressed as versioned, machine-readable rules in the Contract Registry (`state.conditionalRules`). Default rules include:

- `HDR-DEVICE-001` — `deviceId` required for `AndroidAPK`
- `HDR-USER-001` — `userId` required when authenticated
- `HDR-SESS-001` — `sessionId` required for session authentication
- `HDR-IDEM-001` — `idempotencyKey` required for retryable financial commands from external clients
- `HDR-BRANCH-001` — `branchId` required for branch-scoped processing

Rules use structured conditions (`AND` / `OR` / `NOT` plus comparison operators). Operand validation enforces `value` vs `values` vs presence operators in the canonical JSON Schema.

## Events

Published domain events include `eventId`, `eventType`, `eventVersion`, `occurredAtUtc`, `correlationId`, `aggregateId`, `aggregateType`, `sourceModule`, and `payload`. Legacy `id` / `name` fields remain for compatibility.

## UI

Schema counters appear under the existing **Audit Log** security extras. No new navigation item.

# Canonical Shared Pagination & Status Schema Specification

`status` and `pagination` are global platform schemas. Every module (Customers, Loans, Savings, Reports, Audit, Monitoring, Workflow, and others) shall reference these definitions from the Global Contract Registry rather than inventing endpoint-specific copies.

## Canonical status schema

Every API response contains exactly one `status` object:

```json
{
  "code": "SUCCESS",
  "category": "Success",
  "httpStatus": 200,
  "message": "Operation completed successfully.",
  "retryable": false,
  "timestampUtc": "2026-09-11T20:41:00Z"
}
```

Allowed categories: `Success`, `Validation`, `Authentication`, `Authorization`, `BusinessRule`, `Conflict`, `RateLimit`, `TemporaryFailure`, `PermanentFailure`, `InternalError`.

Standard codes include `SUCCESS` (200/201/202/204), `VALIDATION_ERROR` (400), `AUTHENTICATION_FAILED` (401), `AUTHORIZATION_FAILED` (403), `RESOURCE_NOT_FOUND` (404), `CONFLICT` (409), `PRECONDITION_FAILED` (412), `PAGE_OUT_OF_RANGE` (416), `BUSINESS_RULE_VIOLATION` (422), `RATE_LIMIT_EXCEEDED` (429), `INTERNAL_ERROR` (500), and `SERVICE_UNAVAILABLE` (503).

## Canonical pagination schema

```json
{
  "page": 1,
  "pageSize": 50,
  "totalItems": 1250,
  "totalPages": 25,
  "hasPrevious": false,
  "hasNext": true,
  "firstPage": 1,
  "lastPage": 25
}
```

Invariants: `page >= 1`, `pageSize >= 1`, `totalItems >= 0`, `firstPage = 1`, `lastPage = totalPages`, `hasPrevious = (page > firstPage)` when pages exist, `hasNext = (page < lastPage)`. Collections return `[]`, never `null`.

Status and pagination schemas version independently (major = breaking, minor = optional fields, patch = clarification). Consuming contracts declare the schema version they implement.

# Canonical Empty-Result Pagination Behavior

An empty result set has **zero available pages**, not one empty page. Clients may request page `1`, but the response indicates that no pages contain data:

```json
{
  "page": 1,
  "pageSize": 50,
  "totalItems": 0,
  "totalPages": 0,
  "hasPrevious": false,
  "hasNext": false,
  "firstPage": 1,
  "lastPage": 0
}
```

`data` is `[]`. This is HTTP 200, not 404 or 204. Clients must not treat an empty result as an error.

# Invalid Page Behavior for Empty Result Sets

- `totalItems = 0` and `page = 1` → HTTP 200, empty collection, canonical empty pagination.
- `totalItems = 0` and `page > 1` → HTTP 416 `PAGE_OUT_OF_RANGE` / `PAG-001`.
- `totalItems > 0` and `page > totalPages` → HTTP 416 with the valid range in the error envelope.
- `page < 1`, `pageSize < 1`, or `pageSize` above the configured maximum → HTTP 400 before pagination is calculated.

Clients treat 200 + empty `data` as success and 416 as a paging error (reset to page 1). SDKs, documentation, and tests must implement the same rules.

## Acceptance

- Every `invokeContract` exchange uses the standardized header and envelope.
- Errors still return propagated identifiers.
- Conditional rules, operand typing, and two-axis metadata are enforced by tests in `tests/api-schema.test.js`.
- Every response references the shared Status schema; every collection references the shared Pagination schema.
- Empty collections allow only page 1; later pages return HTTP 416.
