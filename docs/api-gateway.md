# Module 20 — API Gateway & External Integration Platform

The gateway is the **only integration entry** for external clients. It is an **in-process engine**. Smile Trust does not start an HTTP REST server or a GraphQL HTTP server. Android, the web portal, USSD, payment providers, and future partners call `dispatchGatewayRequest`.

Business modules are not called directly by external clients. The gateway authenticates, authorizes, rate-limits, validates, and then routes to Payment, Monitoring, Backup, and other engines. It does **not** post collections, change interest **15%**, the 31-day cycle, cashier GHS **1,000**, or `customerBalance`.

## Pipeline

Receive → TLS (required for non-session clients) → Authentication → Authorization → Rate limit → Request validation → Idempotency → Routing → Business processing → Response validation → Audit → Return.

Every response uses a standard envelope: correlation ID, request ID, timestamp, status, message, data, error. Secrets, PINs, and tokens are redacted.

## Clients and auth

Seeded clients: Android APK, Web Administration Portal, Mobile Money providers, USSD. New types can be registered without changing gateway architecture.

Supported auth: session, API key (hash only), device token, JWT (stored hash), service account. OAuth 2.0 is reserved.

## Versioning

`v1` is active. `v2` is preview. URI (`/v1/...`) and `X-API-Version` are recorded on the in-process contract. OpenAPI is generated from `ROUTE_CATALOG` and stays in sync with implemented routes.

GraphQL is a thin field map onto the same router (`executeGraphQL`). There is no GraphQL HTTP listener.

## Webhooks

Subscriptions store a secret hash. Deliveries go through the Module 18 scheduler (`webhook_delivery`). Replay re-queues. Inbound MoMo callbacks enter through `receiveInboundWebhook` and then the Payment Engine.

## Monitoring and audit

Request counts, errors, rate-limit hits, and auth failures are written to Module 19. Configuration changes and completed requests are audited.

## UI

Extras sit **below** Backup / scheduler / monitoring. No new nav item. Reports extras export CSV.

## Implementation

- Engine: `src/core/api-gateway-ops.js`, `src/core/api-gateway-lifecycle.js`
- Extras: `src/ui/api-gateway-views.js`
- Schema: `supabase/migrations/031_api_gateway.sql`
