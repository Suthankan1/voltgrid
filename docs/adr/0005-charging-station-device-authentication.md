# 5. Charging Station Device Authentication

## Context
Charging stations connect to VoltGrid Station Service via WebSocket carrying the OCPP 2.0.1 subprotocol (`ocpp2.0.1`). In the initial implementation, stations connected by supplying a station identifier in the URL path (`/ocpp/{stationId}`), and authentication was either disabled or performed superficial username checks without password verification.

## Security Problem
Allowing charging stations to connect without cryptographic authentication permits rogue actors to impersonate legitimate chargers, submit falsified meter values, inject rogue transaction events, hijack station availability status, or perform denial-of-service against station connectivity.

## Alternatives Considered
1. **Station ID in URL Path Only (Security Profile 0 - Insecure)**:
   - *Pros*: Zero configuration.
   - *Cons*: Trivially spoofed; zero integrity or confidentiality.
2. **OCPP Basic Authentication over WSS (Security Profile 2)**:
   - *Pros*: Supported by standard OCPP 2.0.1 chargers. Charger supplies HTTP `Authorization: Basic <base64(stationId:password)>` during the WebSocket upgrade request. Backend verifies credentials against hashed device secrets.
   - *Cons*: Requires TLS in production to protect credentials in flight; requires secure credential provisioning and rotation lifecycles.
3. **Client Certificates / mTLS (Security Profile 3)**:
   - *Pros*: Strongest cryptographic authentication; mutual certificate validation.
   - *Cons*: Requires hardware PKI infrastructure on chargers and mTLS termination at proxy/load balancer, gated by VG-203.

## Selected Approach
Implement **OCPP Security Profile 2 (HTTP Basic Authentication with Hashed Device Credentials)** and lay the architectural foundation for **Security Profile 3**:
- Each charging station possesses a managed credential record in `station_credentials`:
  - `id`: Unique credential UUID.
  - `station_id`: Foreign key to `charging_stations`.
  - `credential_type`: `BASIC_AUTH` (or `CLIENT_CERTIFICATE`).
  - `password_hash`: Salted hash using PBKDF2WithHmacSHA256 (or BCrypt) with high iteration counts.
  - `status`: `ACTIVE`, `ROTATED` (grace period), `REVOKED`.
  - `created_at`, `expires_at`, `revoked_at`.
- During WebSocket handshake in `OcppHandshakeInterceptor`:
  - Extract `Authorization: Basic <base64(stationId:password)>`.
  - Enforce that the basic auth username matches the URL path `stationId`.
  - Retrieve active credential for `stationId` and verify password hash using constant-time comparison.
  - Reject missing, malformed, invalid, or revoked credentials with HTTP 401 Unauthorized (`WWW-Authenticate: Basic realm="VoltGrid CSMS"`).
  - Bind authenticated station identity to the established WebSocket session attributes.
- Support **credential rotation**: allows a newly provisioned credential while temporarily accepting the previous credential during a bounded transition window, followed by explicit revocation.

## Rationale
- Native compliance with OCPP 2.0.1 Part 4 (Security) Profile 2.
- Protects device credentials at rest using industry-standard salted cryptographic hashes.
- Mitigates station impersonation and unauthorized connectivity.

## Trade-offs
- Station provisioning requires generating high-entropy device passwords and distributing them to the charger installation team.

## Trust Boundaries
- Untrusted internet -> `OcppHandshakeInterceptor`. All incoming connections are unauthenticated until the handshake successfully validates the device credential.

## Failure Behavior
- Handshake returns HTTP 401 Unauthorized on failed authentication. No WebSocket session is established, and no station status or outbox event is generated.
- Credential revocation immediately terminates any active session associated with the revoked credential.

## Migration Implications
- A migration strategy allows existing local development stations to receive provisioned credentials, with an explicit profile switch (`voltgrid.ocpp.auth-required=true`).

## Operational Implications
- Station credentials can be provisioned, rotated, and revoked via authenticated GraphQL mutations.

## Testing Strategy
- Positive tests for valid credential authentication.
- Negative tests for missing header, malformed Base64, wrong stationId, wrong password, revoked credential, expired credential, and disabled station.
- Concurrency and rotation tests verifying seamless switchover.

## Remaining Dependencies
- Production TLS termination and hardware certificate issuance (deferred to VG-203).
