# VG-202: 05 - Service Identity & Key Migration

> Historical VG-202 evidence. Current remediation and readiness are tracked in [VG-202R remediation status](remediation-status.md).

## 1. Finding Resolution: SEC-003

In compliance with ADR-0006, ADR-0007, and historical finding SEC-003:
- Prior to VG-202, `TokenFingerprintService` had a hardcoded default HMAC key and lacked support for key rotation without mass invalidation of active customer RFID tokens.
- VG-202 implements multi-versioned HMAC key management and transparent on-access re-fingerprinting.

## 2. Multi-Version HMAC & Database Schema

- Database migration `V2__add_versioned_token_fingerprints.sql` adds `key_version VARCHAR(16) NOT NULL DEFAULT 'v1'` to `authorization_tokens`.
- `TokenFingerprintService` supports:
  - Active version (`v2` by default) used for all newly provisioned tokens.
  - Legacy keys map (`v1`, etc.) used during lookup fallback.
- In `AuthorizationDecisionService.authorizeToken()`:
  - First queries token by active fingerprint (`v2`).
  - If not found, computes fingerprint using legacy key versions (`v1`).
  - When a legacy token matches, automatically migrates the database record: updates `token_fingerprint` to active version, sets `key_version` to active version, and saves entity.

## 3. Secret Redaction & Startup Validation

- `TokenFingerprintService.toString()` returns `[REDACTED]` to prevent secret leakage in application logs.
- Startup validation: in secure profiles (`prod`, `staging`), any key shorter than 32 hex characters or containing known weak placeholders (`change-me`, `development`) causes a fail-fast startup crash.

## 4. Inter-Service gRPC Authentication

In compliance with ADR-0006:
- `authorization-service` registers `ServiceAuthenticationInterceptor` on the gRPC Netty server.
- Intercepts incoming RPC calls and validates headers:
  - `x-voltgrid-service-id: station-service`
  - `x-voltgrid-service-key: <configured_secret>`
- Rejects unauthorized callers with `Status.UNAUTHENTICATED`.
- `station-service` attaches metadata headers via `AuthorizationGrpcClientConfiguration`.

Verified by 5 tests in `TokenFingerprintMigrationTests` and 5 tests in `ServiceAuthenticationInterceptorTests`.
