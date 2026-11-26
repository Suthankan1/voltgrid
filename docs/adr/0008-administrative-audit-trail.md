# 8. Administrative Audit Trail

## Context
Commercial EV charging systems are subject to strict regulatory, financial, and operational accountability. Administrative operations—such as station registration, credential issuance, credential rotation, credential revocation, role assignments, and organization configuration—must be traceable.

## Security Problem
Without an immutable administrative audit log, unauthorized configuration changes, credential hijacking, and rogue administrative actions cannot be detected, investigated, or attributed. Relying on application logs is insufficient because logs are transient, vulnerable to truncation, and lack structured queryability.

## Alternatives Considered
1. **Text File Logging (JSON structured logs to file/stdout)**:
   - *Pros*: Standard logging approach.
   - *Cons*: Cannot be queried by authorized operators through the UI; easily tampered with or purged.
2. **Dedicated External SIEM / Audit Service**:
   - *Pros*: Isolated audit storage.
   - *Cons*: Excessive architectural complexity for current milestone; requires external infrastructure dependencies.
3. **Database-backed Append-Only Audit Trail (`administrative_audit_events`)**:
   - *Pros*: Stored in a dedicated relational table with append-only semantics, indexed by `organization_id`, `actor_id`, `resource_type`, and `timestamp`. Supports tenant-scoped GraphQL queries for authorized administrators. Outbox/transactional consistency guarantees event capture.
   - *Cons*: Database administrators have physical access unless cryptographic hashing/tamper-evident chains are applied (noted as an external infrastructure control).

## Selected Approach
Implement a **Database-Backed Append-Only Administrative Audit Trail**:
- **Audit Entity (`administrative_audit_events`)**:
  - `id`: UUID primary key.
  - `event_type`: e.g., `STATION_REGISTERED`, `CREDENTIAL_PROVISIONED`, `CREDENTIAL_ROTATED`, `CREDENTIAL_REVOKED`, `MEMBERSHIP_GRANTED`, `MEMBERSHIP_REVOKED`, `AUTH_FAILURE`.
  - `actor_id`: Subject/username of the actor.
  - `actor_type`: `USER`, `SYSTEM`, `STATION`.
  - `organization_id`: Tenant context.
  - `resource_type`: `STATION`, `CREDENTIAL`, `ORGANIZATION`, `MEMBERSHIP`.
  - `resource_id`: Identifier of the affected resource.
  - `action`: Specific action executed.
  - `outcome`: `SUCCESS`, `DENIED`, `FAILED`.
  - `correlation_id`: Request correlation ID / trace ID.
  - `metadata`: JSON payload containing non-sensitive change details.
  - `timestamp`: UTC timestamp.
- **Append-Only Enforcement**: Repository exposes only `save()` and read queries. No update or delete methods exist in the application.
- **Redaction**: Strict filter scrubs passwords, tokens, raw credentials, and secrets before persisting metadata.
- **Tenant-Scoped Querying**: GraphQL query `auditEvents(organizationId, ...)` requires `audit:read` permission and filters strictly by the authorized tenant.

## Rationale
- Satisfies SEC-04 product requirements.
- Provides immediate operational accountability within the operator web application.
- Guarantees non-sensitive audit logging with correlation across distributed services.

## Trade-offs
- Audit table grows over time; requires retention and pruning policies in future governance milestones (ADM-02).

## Trust Boundaries
- Audit recorder runs in trusted backend application context. Actor identity is extracted from authenticated security context, never from client input.

## Failure Behavior
- Audit persistence failure logs an alert; critical administrative mutations execute within the same transaction to guarantee audit-transaction atomicity.

## Migration Implications
- Flyway migration creates `administrative_audit_events` with composite indexes on `(organization_id, timestamp DESC)`.

## Operational Implications
- Operator web settings provides an audit log viewer for authorized organization administrators.

## Testing Strategy
- Tests verifying audit record generation on registration, credential rotation, and revocation.
- Verification that sensitive data (passwords, keys) is never present in audit metadata.
- Negative tests verifying that non-authorized users cannot query audit logs.

## Remaining Dependencies
- Immutable WORM storage and long-term compliance retention (ADM-02, Issue #18).
