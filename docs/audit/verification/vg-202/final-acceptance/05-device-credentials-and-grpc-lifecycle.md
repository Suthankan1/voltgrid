# VG-202R.5 Device credentials and gRPC lifecycle

On 2026-11-27, the R.5 slice was implemented and verified from main `1ad893642125015a2a7fbe24787bbd38ad18da48` on `remediation/vg-202r5-device-credentials-grpc`.

## Implementation summary and verified invariants

### 1. High-entropy station credential generation
- `StationCredentialService.generateSecurePassword()` generates 32 bytes of cryptographic entropy formatted as unpadded URL-safe Base64 (43 characters).
- Added `provisionGeneratedCredential(stationId, actorId, organizationId)` returning `GeneratedStationCredential` (the entity and generated plaintext password for single-display return).

### 2. Versioned hashing format and transparent upgrade
- New hashes use versioned `pbkdf2-v2:<iterations>:<salt>:<hash>` with OWASP-aligned 210,000 iterations of `PBKDF2WithHmacSHA256` and 16-byte random salt.
- Legacy `pbkdf2:<salt>:<hash>` (65,536 iterations) remains supported for verification.
- `needsRehash(storedHash)` identifies legacy format or insufficient iterations.
- On successful authentication, any legacy credential hash is transparently upgraded to `pbkdf2-v2` in the database without service interruption or operator action.

### 3. Bounded verification and concurrency limiting
- Expensive PBKDF2 hashing is bounded by a concurrency limiter (`hashingLimiter`, 16 permits). Requests exceeding capacity fail fast with a controlled exception rather than starving server CPU threads.
- Input length is strictly bounded (password must be between 8 and 256 characters).
- Recoverable throttling tracks failed authentication attempts per station identifier: 10 failed attempts within a 60-second window trigger a 5-second backoff period. During backoff, requests are denied early without running expensive PBKDF2 hashing, preventing brute-force CPU exhaustion without permanent lockout.

### 4. Revocation and rotation commit boundary
- `sessionFencer.terminateSession` executes strictly in the `afterCommit` phase of Spring transaction synchronization.
- If a provisioning, rotation or revocation transaction rolls back (e.g. database error or constraint violation), the active connection is not terminated and fencing is skipped.

### 5. Running gRPC server negative and allowlist matrix
- In `AuthorizationGrpcIntegrationTests`:
  - Missing service credentials (`x-voltgrid-service-id`, `x-voltgrid-service-key`) are rejected by the Netty gRPC server with `Status.Code.UNAUTHENTICATED`.
  - Unknown/unauthorized caller service ID (e.g. `unauthorized-rogue-service`) is rejected with `Status.Code.UNAUTHENTICATED`.
  - Invalid service key is rejected with `Status.Code.UNAUTHENTICATED`.
  - Token with legacy HMAC key version (`v1`) is authorized over gRPC, decision returned as `ACCEPTED`, and database entity transparently migrated to active version `v2`.
  - Token hashed with a retired HMAC key version (`v0`, not configured in legacy keys) is rejected over gRPC as `UNKNOWN_TOKEN`.

## Verification results

| Module | Command | Result |
| --- | --- | --- |
| `station-service` | `./mvnw test -Dtest=StationCredentialServiceTests,OcppHandshakeInterceptorCredentialTests,OcppHandshakeInterceptorAuthTests` | 17 tests passed (12 credential service, 5 handshake credential, 5 auth), 0 failures, 0 errors, 0 skipped |
| `station-service` | Full regression verify suite | 247 tests passed, 0 failures, 0 errors, 0 skipped |
| `authorization-service` | `./mvnw test -Dtest=AuthorizationGrpcIntegrationTests,TokenFingerprintMigrationTests,ServiceAuthenticationInterceptorTests` | 22 tests passed (11 gRPC integration, 6 fingerprint migration, 5 interceptor), 0 failures, 0 errors, 0 skipped |
| `authorization-service` | Full `./mvnw verify` | 35 tests passed, 0 failures, 0 errors, 0 skipped |

Related to issues #4, #15, #22.
