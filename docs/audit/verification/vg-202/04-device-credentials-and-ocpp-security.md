# VG-202: 04 - Device Credentials & OCPP Security

## 1. Finding Resolution: SEC-001

In compliance with ADR-0005, Issue [#15](https://github.com/Suthankan1/voltgrid/issues/15), and historical finding SEC-001:
- Prior to VG-202, any client could connect to `/ocpp/{stationId}` knowing only the station identifier.
- VG-202 introduces `StationCredentialService` and salted PBKDF2 device credentials.

## 2. Cryptographic Storage & Algorithms

- **Algorithm**: `PBKDF2WithHmacSHA256`
- **Iterations**: 65,536 iterations
- **Salt**: 16-byte cryptographically secure random salt generated via `java.security.SecureRandom`
- **Key Length**: 256 bits (32 bytes)
- **Constant-Time Verification**: `MessageDigest.isEqual()` to eliminate timing attack vectors.
- Raw passwords are never persisted to disk or database; only the salt and hash are stored in `station_credentials`.

## 3. Handshake Interception & Lifecycle Operations

In `OcppHandshakeInterceptor`:
- Extracts HTTP `Authorization: Basic <base64(stationId:password)>`.
- Verifies that the username in the Basic auth header matches the `stationId` in the WebSocket path.
- Validates the password against the active salted hash via `StationCredentialService.validateCredential()`.
- Rejects invalid passwords with HTTP 401 Unauthorized and `WWW-Authenticate: Basic realm="VoltGrid CSMS"`.
- Supports administrative credential rotation:
  - `rotateCredential(stationId, newPassword, actorId, organizationId)` replaces active hash and records an audit event.
  - `revokeCredential(stationId, actorId, organizationId)` sets credential status to `REVOKED`.

Verified empirically by 5 unit tests in `OcppHandshakeInterceptorCredentialTests` and 5 tests in `StationCredentialServiceTests`.
