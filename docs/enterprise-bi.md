# Module 27 — Enterprise Business Intelligence, KPI & Schema Registries

The Enterprise BI module is the **canonical KPI, Metric, and Schema Registry** for the SMILE TRUST SUSU MANAGEMENT SYSTEM.

Module 11 remains the live Reports / BI panel UI and operational report runner. This module does **not** post collections, replace `handleCollection`, change loan interest **15%**, the 31-day cycle, cashier GHS **1,000**, or `customerBalance`.

There is no REST or GraphQL HTTP server. Gateway routes are in-process Module 20 contracts.

## Implementation

- Lifecycle: `src/core/bi-lifecycle.js`
- Metric JSON Schema: `src/core/metric-schema.js`
- Schema Metadata JSON Schema: `src/core/schema-metadata.js`
- Schema checksum canonicalization: `src/core/schema-checksum.js`
- Engine: `src/core/bi-ops.js`
- Public contracts: `src/core/bi-api.js`
- Extras: `src/ui/bi-views.js` under existing **Audit Log** and **Reports**
- Schema: `supabase/migrations/040_enterprise_bi.sql`
- Tests: `tests/bi-ops.test.js`

## Canonical KPI formulas

Every published KPI has one formula, input metrics, aggregation period, unit, rounding, and missing-data policy. Examples:

| KPI | Formula |
|-----|---------|
| Collection Rate | `(MET-SAV-001 / MET-SAV-002) × 100` |
| Loan Recovery Rate | `(MET-LOAN-001 / MET-LOAN-002) × 100` |
| Savings Growth Rate | `((MET-SAV-003 − MET-SAV-004) / MET-SAV-004) × 100` |
| Customer Growth Rate | `(MET-CUS-001 / MET-CUS-002) × 100` |
| Active Membership Rate | `(MET-CUS-003 / MET-CUS-004) × 100` |
| Branch Profitability | `MET-ACC-001 − MET-ACC-002` |
| Collector Productivity | `MET-COL-001 / MET-COL-002` |
| Workflow SLA Compliance | `(MET-WF-001 / MET-WF-002) × 100` |
| System Availability | `((MET-MON-001 − MET-MON-002) / MET-MON-001) × 100` |
| Payment Success Rate | `(MET-PAY-001 / MET-PAY-002) × 100` |

Zero denominators return **0**. Percentages round to two decimals (`RoundHalfUp`). Calculations record the formula version.

## Canonical KPI input metrics

Metrics use `MET-<CATEGORY>-<NUMBER>` and validate against `urn:smiletrust:schemas:metric-definition:v1` before registration. Required properties: metricId (UUID), metricCode, metricName, description, dataType, unitOfMeasure, sourceModule, sourceEntity, aggregationMethod, timeGranularity, roundingPolicy, missingDataPolicy, version, effectiveFrom, ownerModule.

Seeded examples: `MET-SAV-001` Total Collected Amount, `MET-PAY-001` Successful Payments, `MET-ACC-001` Operating Revenue.

The Metric Registry is the single source of truth for Monitoring, Reporting, Workflow, Accounting, Rule Engine, and BI.

## Schema metadata governance

Every published machine-readable schema carries metadata validating against `urn:smiletrust:schemas:schema-metadata:v1` (`SCH-META-001`): schemaId, schemaCode, schemaName, schemaType, version, status, ownerModule, owningTeam, approvalReference, effectiveFrom, compatibilityLevel, registryUri, documentationUri, checksum (`SHA-256:<64 lowercase hex>`), publishedAtUtc, publishedBy.

Statuses: Draft → Testing → Approved → Published → Deprecated → Retired. Only Published schemas may be referenced in production. Compatibility: BackwardCompatible | ForwardCompatible | BreakingChange.

Checksum engine: `src/core/schema-checksum.js` (canonicalization + SHA-256).

## Canonical Schema Metadata JSON Schema Specification

The Schema Metadata JSON Schema (`SCH-META-001`) is the platform-wide contract for schema publication metadata. Checksums over schema definitions use the canonicalization procedure below; the metadata `checksum` property itself validates against `^SHA-256:[a-f0-9]{64}$`.

# CANONICAL SCHEMA CHECKSUM CANONICALIZATION PROCEDURE

This specification defines the deterministic canonicalization procedure used to calculate the checksum for every published schema.

The objective is to ensure that identical logical schemas always produce the same checksum regardless of programming language, operating system, storage format, or serialization library.

This specification applies to all machine-readable schemas published by the SMILE TRUST SUSU MANAGEMENT SYSTEM.

---

# DESIGN PRINCIPLES

The checksum generation process shall be:

- Deterministic.
- Platform-independent.
- Repeatable.
- Immutable for identical schema content.
- Resistant to insignificant formatting differences.

Checksum generation shall operate only on the schema definition and shall exclude publication-specific metadata.

---

# INPUT TO THE CHECKSUM

The checksum shall be calculated from the canonical schema document after removing fields that do not describe the schema itself.

The following fields shall be excluded before checksum generation:

- `schemaMetadata`
- `checksum`
- `publishedAtUtc`
- `publishedBy`
- `approvalReference`
- Any implementation-specific transport metadata
- Any comments or documentation annotations that are not part of the schema definition

No other fields shall be removed.

---

# CANONICALIZATION PROCEDURE

Before hashing, the schema document shall be transformed using the following steps in order:

1. Remove excluded metadata fields.
2. Parse the document into its logical data model.
3. Sort all object property names lexicographically using Unicode code-point order.
4. Preserve the order of array elements exactly as defined by the schema author. Array order shall not be altered.
5. Represent numbers using their shortest valid JSON representation (for example, `1` instead of `1.0`).
6. Represent Boolean values as the JSON literals `true` and `false`.
7. Represent `null` using the JSON literal `null`.
8. Encode all strings using standard JSON escaping rules.
9. Serialize the document as UTF-8 without a byte order mark (BOM).
10. Omit insignificant whitespace, including indentation, tabs, carriage returns, and trailing spaces.

The resulting byte sequence is the canonical representation used for hashing.

---

# HASH ALGORITHM

The platform shall use:

- Algorithm: **SHA-256**
- Input: Canonical UTF-8 byte sequence
- Output: 32-byte digest encoded as 64 lowercase hexadecimal characters

The metadata field shall be formatted as:

```text
SHA-256:<64 lowercase hexadecimal characters>
```

Example:

```text
SHA-256:4f8d8d8b8d74d3d68f8b8f4db4a6f43b81d5c2bb61b6a48cb5e0fd7d47b5a2c1
```

---

# DETERMINISM REQUIREMENTS

The following changes shall **not** affect the checksum:

- Whitespace changes.
- Indentation changes.
- Line ending differences (`LF` vs `CRLF`).
- Object property ordering in the original source.
- Pretty-printing versus compact formatting.
- Serialization library differences.

The following changes **shall** change the checksum:

- Adding or removing schema properties.
- Changing property names.
- Changing validation rules.
- Changing required fields.
- Changing enumeration values.
- Changing constraints (such as `minimum`, `maximum`, `pattern`, or `format`).
- Changing array element order where order is semantically significant.
- Changing default values when they are part of the schema definition.

---

# VERIFICATION PROCEDURE

When validating a published schema:

1. Retrieve the published schema.
2. Remove excluded metadata fields.
3. Apply the canonicalization procedure.
4. Compute the SHA-256 digest.
5. Compare the computed checksum with the published checksum.
6. Reject the schema if the values differ.

Checksum verification shall occur before schema registration, replication, import, or publication.

---

# IMPLEMENTATION REQUIREMENTS

All platform implementations (Android, Web, Backend Services, CLI tools, and SDKs) shall use this canonicalization procedure.

Implementations shall not substitute alternative serialization, hashing, or normalization algorithms.

Compliance tests shall include cross-language verification to ensure identical checksums are produced from the same logical schema.

---

# AUDIT REQUIREMENTS

Every checksum generation and verification event shall record:

- Schema ID
- Schema Version
- Checksum Algorithm
- Computed Checksum
- Verification Result
- Timestamp (UTC)
- Executing Service
- Correlation ID

Audit records shall be immutable.

---

# ACCEPTANCE CRITERIA

The Canonical Schema Checksum Canonicalization Procedure is complete only when:

- Every published schema checksum is generated using the documented canonicalization process.
- Formatting differences do not affect checksum values.
- Identical logical schemas produce identical SHA-256 checksums across all supported platforms and programming languages.
- Schema verification rejects mismatched or tampered schema definitions.
- Cross-language compliance tests confirm deterministic checksum generation for Android, web, backend, and SDK implementations.
- Automated tests verify canonicalization, metadata exclusion, UTF-8 serialization, property ordering, hash generation, checksum verification, and backward compatibility across all published schema versions.

# CHECKSUM FORMAT CONSISTENCY RESOLUTION

This specification resolves all checksum format inconsistencies across the SMILE TRUST SUSU MANAGEMENT SYSTEM.

Where previous specifications differ regarding hexadecimal letter case or checksum formatting, this specification is authoritative and supersedes earlier definitions.

---

# CANONICAL CHECKSUM FORMAT

The platform shall represent every schema checksum using the following format:

```text id="chkfmt01"
SHA-256:<64 lowercase hexadecimal characters>
```

Example:

```text id="chkfmt02"
SHA-256:4f8d8d8b8d74d3d68f8b8f4db4a6f43b81d5c2bb61b6a48cb5e0fd7d47b5a2c1
```

Exactly one prefix shall be used:

- `SHA-256:`

The hexadecimal digest shall contain:

- exactly 64 characters
- digits `0–9`
- lowercase letters `a–f` only

Uppercase hexadecimal characters are not permitted.

---

# CANONICAL JSON SCHEMA PATTERN

The checksum property shall use the following JSON Schema validation rule:

```json id="chkfmt03"
{
  "checksum": {
    "type": "string",
    "pattern": "^SHA-256:[a-f0-9]{64}$"
  }
}
```

This pattern replaces any previous checksum validation pattern.

---

# NORMALIZATION RULE

Checksum producers shall:

1. Compute the SHA-256 digest.
2. Encode the digest using lowercase hexadecimal.
3. Prepend the literal prefix `SHA-256:`.
4. Publish the resulting string without additional whitespace.

Consumers shall compare checksum values exactly as published.

---

# COMPARISON RULES

Checksum verification shall perform an exact, case-sensitive comparison.

The following values are **not** equivalent:

```text id="chkfmt04"
SHA-256:ABCDEF...
```

```text id="chkfmt05"
SHA-256:abcdef...
```

Only the lowercase representation is valid.

Consumers shall reject checksum values that do not conform to the canonical format rather than silently converting them.

---

# FUTURE HASH ALGORITHMS

If additional hash algorithms are introduced in future platform versions, each shall define:

- a unique algorithm prefix
- a dedicated JSON Schema pattern
- a canonical encoding
- a versioned migration policy

The SHA-256 format defined here remains unchanged for all schema versions that reference it.

---

# BACKWARD COMPATIBILITY

Existing published schemas using uppercase hexadecimal shall be handled as follows:

- They remain valid historical artifacts.
- Republishing or reissuing a schema shall regenerate the checksum using the canonical lowercase format.
- New publications shall not emit uppercase hexadecimal digests.

Historical checksum values shall not be modified in audit records.

---

# IMPLEMENTATION REQUIREMENTS

Every implementation, including Android, Web, Backend Services, SDKs, CLI tools, and validation libraries, shall:

- Produce only canonical lowercase checksum strings.
- Validate against the canonical JSON Schema pattern.
- Reject malformed checksum values before schema registration or publication.

---

# ACCEPTANCE CRITERIA

The Checksum Format Consistency Resolution specification is complete only when:

- A single canonical checksum representation is defined for the platform.
- The JSON Schema pattern requires lowercase hexadecimal characters only.
- Producers generate only canonical lowercase checksum values.
- Consumers perform exact case-sensitive validation without implicit normalization.
- Historical records remain unchanged while all future publications use the canonical format.
- Automated tests verify checksum generation, schema validation, rejection of uppercase digests for new publications, exact comparison behavior, and cross-platform consistency.

## Public contracts

Commands: `Bi.Metric.Register.v1`, `Bi.Metric.Validate.v1`, `Bi.Kpi.Calculate.v1`, `Bi.Kpi.CalculateAll.v1`, `Bi.Kpi.Publish.v1`, `Bi.Schema.Register.v1`, `Bi.Schema.Validate.v1`.

Queries: `Bi.Metric.Get.v1`, `Bi.Metric.List.v1`, `Bi.Kpi.List.v1`, `Bi.Schema.List.v1`, `Bi.Statistics.v1`.

Events: `MetricRegistered`, `KpiPublished`, `SchemaPublished`.

Error codes: `BI-001` … `BI-013`.

Any module may invoke public BI contracts for registry/query use. Modules must not invent ad hoc KPI formulas outside this registry.

## Configuration

- Feature flag: `enableEnterpriseBi`
- Job: `bi_kpi_refresh`

## Acceptance

- Every KPI references only registered metrics.
- Metric and schema metadata validate against published JSON Schemas.
- Schema Registry holds metric-definition and schema-metadata schemas with canonical SHA-256 checksums.
- Formatting differences do not change checksums; uppercase digests are rejected for new publications.
- Automated tests cover validation, uniqueness, formulas, zero denominators, registry reuse, canonicalization, and checksum verification.
