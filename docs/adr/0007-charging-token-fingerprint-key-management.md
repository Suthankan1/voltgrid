# 7. Charging Token Fingerprint Key Management

## Context
In `authorization-service`, physical RFID tags and charging tokens are stored as HMAC-SHA256 fingerprints rather than raw values to protect driver identity. The current implementation uses a single HMAC key configured via `voltgrid.authorization.token-hmac-key`, defaulting to an insecure development string (`voltgrid-local-development-hmac-key-change-me`).

## Security Problem
Using an insecure default key in production allows anyone knowing the default string to compute rainbow tables or precompute fingerprints for known RFID tags, defeating the privacy protections of hashing. Furthermore, lacking a key rotation mechanism means that if the key is rotated, all existing charging tokens become unmatchable, breaking customer charging access.

## Alternatives Considered
1. **Single Key Replacement (Hard Cutover)**:
   - *Pros*: Simple.
   - *Cons*: Invalidates all existing token fingerprints in the database simultaneously.
2. **Reversible Encryption (AES-GCM)**:
   - *Pros*: Keys can be re-encrypted.
   - *Cons*: Stores decryptable RFID tags in the database, violating privacy requirements and introducing data exposure liabilities.
3. **Versioned Multi-Key HMAC Fingerprint Model with Transparent Migration**:
   - *Pros*: Supports multiple configured keys (active key + permitted legacy keys). Token lookups query across active and legacy keys. When an active token is presented matching a legacy key, its stored fingerprint is transparently migrated to the active key.
   - *Cons*: Requires tracking key versions in configuration and database schemas.

## Selected Approach
Implement a **Versioned Multi-Key HMAC Fingerprint Service (`TokenFingerprintService`)**:
- **Active Key**: Required key for generating new fingerprints (e.g., `v2`).
- **Legacy Keys**: Map of historical key versions (e.g., `v1 -> key1`).
- **Lookup Strategy**: When verifying an RFID token, compute candidate fingerprints using the active key and all configured legacy keys (`fingerprint(token, version)`). Query database for matching record.
- **Transparent Migration**: If a match is found using a legacy key, the record's fingerprint is updated to the active key within the transaction.
- **Fail Closed on Weak / Missing Key**: In production/secure profiles, missing HMAC keys or keys with entropy below 256 bits (32 bytes) fail startup immediately.
- **Secret Redaction**: HMAC keys are scrubbed and never printed in logs or error messages.

## Rationale
- Completely eliminates insecure default secrets in production.
- Allows seamless HMAC key rotation without operational downtime or invalidating existing tokens.
- Preserves token irreversibility and privacy at rest.

## Trade-offs
- Verification computes up to $N$ HMAC-SHA256 calculations where $N$ is the count of active + permitted legacy keys (typically $N \le 2$).

## Trust Boundaries
- Token fingerprinting is internal to `authorization-service`. Raw RFID tokens are never persisted or exposed outside the authorization request.

## Failure Behavior
- Missing or weak key in non-dev profile halts application startup.
- Unmatched tokens return `AUTHORIZATION_REASON_UNKNOWN_TOKEN`.

## Migration Implications
- Existing dev database tokens using `v1` (`voltgrid-local-development-hmac-key-change-me`) can be configured as a legacy key during migration so existing test tokens continue to resolve while migrating to `v2`.

## Operational Implications
- Operators can rotate keys by promoting a new key to `active` and moving the previous active key to `legacy`.

## Testing Strategy
- Tests for startup failure on missing/short keys.
- Tests for token resolution across active and legacy keys.
- Tests for transparent migration from legacy key to active key.
- Concurrency and duplicate detection tests.

## Remaining Dependencies
- External secrets manager integration (AWS Secrets Manager / Vault) in VG-203.
