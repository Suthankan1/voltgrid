# 09 — VG-202 Readiness Assessment

> **Milestone Handoff**: VG-201 → VG-202
> **Evaluated Target**: [Issue #4 — VG-202: Identity and access management, station credential lifecycle and RBAC](https://github.com/Suthankan1/voltgrid/issues/4)
> **Master Roadmap**: [Issue #64 — Commercial Development Roadmap](https://github.com/Suthankan1/voltgrid/issues/64)
> **Assessment Date**: 2026-11-26

---

## 1. Readiness Evaluation Matrix

| Category | Assessment Criteria | Evaluation | Status |
|---|---|---|---|
| **Core Station Lifecycle** | Station registration, connectivity, boot, status notification, heartbeat | All 20 lifecycle steps verified passing in live isolated stack | **PASSED** |
| **Transaction Integrity** | Sequence handling, completeness audit, meter sample ingestion | Infinite loops & crashes resolved; regression tests passing | **PASSED** |
| **Database Migrations** | Flyway sequence health, foreign keys, schema integrity | Migrations V1–V14 applied cleanly; indexes verified | **PASSED** |
| **Connection Ownership** | Reconnect teardown protection, session registry | In-memory registry verified; distributed fencing noted for VG-204 | **PASSED** |
| **Outbox & Projection** | Stale offline transitions, transactional outbox, Kafka relay | Stale offline outbox emission verified; projection recovery tested | **PASSED** |
| **Local Environment** | Docker Compose isolation, port conflicts, clean cleanup | Port 9090 collision resolved; loopback bindings verified | **PASSED** |
| **Backend Test Health** | Maven test suites compile and pass without skips | 220 tests passed across 4 modules, 0 failed, 0 skipped | **PASSED** |
| **Frontend Test Health** | Operator Web unit, lint, tsc, build, Playwright, a11y | 168 unit tests, lint, tsc, build, 36 E2E, 1 a11y passed | **PASSED** |
| **Critical/High Findings** | No unmitigated critical bugs blocking development | Core crash bugs resolved; identity findings properly gated for VG-202 | **PASSED** |

---

## 2. Verdict

### **READY FOR VG-202 WITH DOCUMENTED NON-BLOCKING LIMITATIONS**

The engineering baseline on `main` is stable, reproducible, and thoroughly verified. The core station lifecycle, transactional outbox, and operator experience provide a solid foundation for the implementation of identity and access management.

---

## 3. Recommended First Implementation Slice for VG-202

Milestone VG-202 addresses **SEC-001 (Unauthenticated OCPP WebSocket)**, **SEC-002 (Zero Backend Authentication)**, and **SEC-003 (HMAC Secret Injection)**.

To maintain small, verifiable pull requests, VG-202 should be structured into the following sequential implementation slices:

### Slice 1: OCPP Station Authentication (SEC-001)
1. **Schema & Credentials**:
   - Create Flyway migration in `station-service` for `station_credentials` table (columns: `station_id VARCHAR(255)`, `password_hash VARCHAR(255)`, `created_at`, `updated_at`).
   - Use BCrypt or PBKDF2 for credential hashing.
2. **Handshake Verification**:
   - Update `OcppHandshakeInterceptor.beforeHandshake` to extract HTTP Basic Authentication credentials from the `Authorization` header.
   - Validate credentials against `station_credentials`.
   - Reject unauthenticated handshakes with HTTP 401 Unauthorized.
3. **Registration Integration**:
   - Update `StationRegistrationService.register` to generate a secure random credential on registration.

### Slice 2: HMAC Key Cloud Injection (SEC-003)
1. In `authorization-service`, remove the hardcoded fallback string in `TokenFingerprintService`.
2. Fail fast on application startup if `AUTHORIZATION_TOKEN_HMAC_KEY` is absent or lower than 256 bits entropy.
3. Update Terraform ECS task definition to inject secret from AWS Secrets Manager.

### Slice 3: Operator API Authentication and RBAC (SEC-002)
1. Introduce Spring Security resource server (`spring-boot-starter-oauth2-resource-server`) across all services.
2. Configure JWT token validation with JWKS endpoint support for external OIDC provider (Keycloak / Cognito).
3. Protect GraphQL queries and mutations with `@PreAuthorize("hasRole('OPERATOR')")`.
4. Ensure operator web frontend forwards Bearer tokens in Server Actions.

---

## 4. Entry Gates for VG-202 Development

- Work must commence on a dedicated branch branched from the verified `main` baseline:
  `feat/vg-202-identity-and-access`
- Preserve existing operator design and client validation.
- Do not bypass authentication in local development using production code branches; use explicit mock test configurations.
