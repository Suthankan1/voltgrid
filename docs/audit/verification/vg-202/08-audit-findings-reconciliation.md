# VG-202: 08 - Audit Findings Reconciliation

## Reconciled Findings Table

| Finding ID | Historical Baseline Severity | Current Assessed Severity | Disposition | Confidence | Reconciling PR | Verification Evidence |
|---|---|---|---|---|---|---|
| **SEC-001** | Critical | Resolved | **Verified Resolved** | 100% | PR #66 | `OcppHandshakeInterceptorCredentialTests`, `StationCredentialServiceTests` |
| **SEC-002** | Critical | Resolved | **Verified Resolved** | 100% | PR #66 | `OperatorApiSecurityFilterTests`, `TenantAuthorizationServiceTests`, `ServiceAuthenticationInterceptorTests` |
| **SEC-003** | High | Resolved | **Verified Resolved** | 100% | PR #66 | `TokenFingerprintMigrationTests`, `TokenFingerprintServiceTests`, `V2__add_versioned_token_fingerprints.sql` |
| **DATA-001** | Moderate | Resolved | **Verified Resolved** | 100% | PR #66 | `V4__add_tenant_and_station_id_width.sql` in `operations-service` |

## Individual Finding Verification

### SEC-001: Unauthenticated OCPP WebSocket Endpoint
- **Problem**: Any client connecting to `/ocpp/{stationId}` was accepted if `stationId` existed, enabling rogue charging simulations.
- **Resolution**: `OcppHandshakeInterceptor` enforces HTTP Basic Authentication matching the station ID and validating a salted PBKDF2WithHmacSHA256 password via `StationCredentialService`.
- **Evidence**: Validated with correct credentials; rejected with 401 when wrong password, wrong station ID, or malformed header is supplied.

### SEC-002: Zero Backend Authentication across GraphQL and gRPC
- **Problem**: GraphQL APIs and gRPC endpoints accepted anonymous unvalidated requests without token inspection or tenant isolation.
- **Resolution**: `OperatorApiSecurityFilter` validates JWT tokens on all HTTP/GraphQL endpoints and sets `SecurityContext`. `TenantAuthorizationService` verifies organization membership and role permissions. `ServiceAuthenticationInterceptor` enforces shared service keys on gRPC calls.
- **Evidence**: Tested with valid JWT, expired JWT, invalid signature, and cross-tenant unauthorized access.

### SEC-003: HMAC Secret Key Fallback and Missing Cloud Injection
- **Problem**: Fixed secret key fallback in code; no support for zero-downtime key rotation without customer token invalidation.
- **Resolution**: Implemented multi-version HMAC key architecture (`v1` to `v2`) with transparent on-access migration and fail-fast startup checks against weak keys in production profiles.
- **Evidence**: Unit tested with active and legacy keys; verified automatic DB update from `v1` to `v2` on query match.
