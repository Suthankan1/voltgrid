# VG-202: 06 - Administrative Audit Trail

> Historical VG-202 evidence. Current remediation and readiness are tracked in [VG-202R remediation status](remediation-status.md).

## 1. Architectural Mandate

In compliance with ADR-0008 and Issue [#16](https://github.com/Suthankan1/voltgrid/issues/16):
- VoltGrid requires an immutable, chronological administrative audit trail for all security-relevant mutations:
  - Organization and site creation
  - Member invitations, role adjustments, and revocations
  - Charging station registration
  - Charging station credential provisioning, rotation, and revocation

## 2. Append-Only Schema & Storage

- Stored in `administrative_audit_events` table in `station-service`:
  - `id`: Unique event identifier (UUID prefixed)
  - `organization_id`: Organization boundary (NULL for platform-level actions)
  - `event_type`: Structured event identifier (e.g. `STATION_REGISTERED`, `CREDENTIAL_PROVISIONED`, `MEMBERSHIP_ROLE_UPDATED`)
  - `actor_id`: User ID or service ID of the initiator
  - `actor_type`: `USER`, `SERVICE`, or `SYSTEM`
  - `resource_type`: `STATION`, `SITE`, `ORGANIZATION`, `MEMBERSHIP`, `CREDENTIAL`
  - `resource_id`: Identifier of the modified resource
  - `action`: `CREATE`, `REGISTER`, `UPDATE_ROLE`, `PROVISION_CREDENTIAL`, `ROTATE_CREDENTIAL`, `REVOKE`
  - `outcome`: `SUCCESS` or `FAILURE`
  - `correlation_id`: Distributed trace/correlation ID
  - `metadata`: JSON payload containing context
  - `created_at`: Non-updatable UTC timestamp

## 3. Sensitive Data Redaction

In `AdministrativeAuditService`:
- Passwords, HMAC keys, salts, and secret credentials are scrubbed prior to writing metadata.
- Unit tested in `AdministrativeAuditServiceTests.shouldRedactSensitiveFieldsInMetadata`:
  - Asserts that raw passwords and tokens are replaced with `[REDACTED]`.
