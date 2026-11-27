# Findings disposition

This update retains the prior remediation record as historical evidence. All VG-202 development scope slices (R.2 through R.6) have now been delivered, tested with negative test suites, reviewed, and merged into `main`.

## Historical progression across remediation slices

| Finding | Original state | R.2 / R.3 Verification | R.4 Verification | R.5 Verification | R.6 Final Verification | Merged PRs | Final Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| IAM-001 | Unauthenticated / insecure token handling | JWKS verification, key rotation, outage behavior | Signed JWT HTTP matrices on Station & Operations | Service identity & gRPC auth matrix | Re-verified across all endpoints | #73, #74, #80, #82 | **Verified Resolved** |
| IAM-002 | Missing operator session boundary | Layout session check | Browser session lifecycle, downgrade/revocation | Authenticated gRPC context | Route mutations origin validation | #75, #78, #79, #81 | **Verified Resolved** |
| IAM-003 | Basic OIDC flow | Keycloak auth code, state, nonce, PKCE | Browser live Keycloak fixtures | N/A | Comprehensive callback & error matrix | #74, #78 | **Verified Resolved** |
| IAM-004 | Session invalidation races | In-memory session tracking | Concurrency refresh races, active revocation, single handle | N/A | Logout cleanup and rotation recovery | #75, #79, #81, #83 | **Verified Resolved** |
| IAM-005 | Missing tenant-scoped operations projection | Historical projection & receipt retention | Operations membership HTTP matrix, Station verification | N/A | Two-tenant isolation | #72, #82, #83 | **Verified Resolved** |
| IAM-006 | Tenant permission enforcement | GraphQL field inventory | Two-tenant query, mutation, filter, pagination | N/A | `mapStation` cross-tenant permission fence | #80, #85 | **Verified Resolved** |
| IAM-007 | Missing final owner protection | DB serialization on org row | Live browser & Operations revocation in <10ms | N/A | Audit logging for role changes | #72, #80, #81, #83, #85 | **Verified Resolved** |
| IAM-008 | Historical station assignment quarantine | Long IDs preserved in V15 Flyway migration | Operations projection replay | N/A | Approved ownership mapping (`mapStation`) with site check | #72, #85 | **Verified Resolved** |
| IAM-009 | Insecure / unthrottled device credentials | Stored hashes & invalidation on commit | N/A | Versioned PBKDF2 (210k), 16-permit Semaphore, 5s backoff | Fencing strictly on transaction commit | #84 | **Verified Resolved** |
| IAM-010 | Missing internal service identity | Local auth flow | N/A | Netty gRPC metadata auth, service key verification | N/A | #84 | **Verified Resolved** |
| IAM-011 | Hardcoded / unversioned HMAC | Initial Authorization tests | N/A | Injected versioned HMAC (`v1` to `v2`), retirement of legacy keys (`v0`) | N/A | #84 | **Verified Resolved** |
| SEC-001 | OCPP unauthenticated handshake | Compatibility mode | N/A | Station credential generation, PBKDF2 upgrade, brute-force backoff | Quarantined assignment protection | #84, #85 | **Verified Resolved** |
| SEC-002 | Token and tenant bypass | Backend token validation | Station/Operations signed-token negative HTTP suites | Service key verification | Strict permission and org boundary checks | #80, #81, #82, #84, #85 | **Verified Resolved** |
| SEC-003 | Hardcoded HMAC keys | Authorization token validation | N/A | Transparent fingerprint migration & rotation | N/A | #84 | **Verified Resolved** |
| DATA-001 | Identifier truncation | V15 migration supports up to 255 chars | Tested across pre-V15 and V5 Operations | N/A | Validated in ownership mapping inputs | #72, #85 | **Verified Resolved** |
| Final owner protection | Unprotected owner deletion | DB trigger and org serialization | Multi-tenant GraphQL rejects final owner removal | N/A | Denied audit event recorded | #72, #80, #85 | **Verified Resolved** |
| Administrative audit | Missing audit trail / tampering | V17 append-only trigger rejects update/delete/truncate | Audit entries on membership mutations | N/A | `recordDeniedEvent`, metadata allowlisting & redaction, bounded paging | #72, #80, #85 | **Verified Resolved** |

## Summary of Completed Acceptance Deliverables

1. **VG-202 R.2 (PR #72):** Offline PostgreSQL schema migration, Flyway checksum preservation, historical data regression suite.
2. **VG-202 R.3 / R.3B / R.3C (PR #73, #74):** Keycloak OIDC authentication, asymmetric JWKS verification, token purpose policy, signed JWT HTTP validation, BFF provider and callback validation.
3. **VG-202 R.3D (PR #75, #79):** Operator session lifecycle, token refresh race handling, secure logout, and same-origin mutation boundaries.
4. **VG-202 R.4 (PR #80, #81, #82, #83):** Station signed-token HTTP matrix, Operator Web live browser membership lifecycle, Operations JWT HTTP matrix, and integrated cross-service membership lifecycle acceptance script (`membership-lifecycle.mjs`).
5. **VG-202 R.5 (PR #84):** Device credentials hardening (cryptographic password generation, OWASP-compliant PBKDF2 with 210,000 iterations and transparent rehash, 16-permit Semaphore concurrency limits, brute-force throttling), transaction commit fencing boundary, and Netty gRPC security test matrix.
6. **VG-202 R.6 (PR #85):** Approved ownership mapping (`mapStation` GraphQL mutation) with tenant site verification, platform-admin fence for cross-tenant transfers, administrative audit denied-event recording, metadata allowlisting, automatic redaction, and bounded pagination.

## Gate Readiness
- **VG-202 Identity and Access Management Foundation:** **COMPLETE & DELIVERED TO MAIN**.
- **VG-203 Transport Encryption & Network Boundary Hardening:** **UNBLOCKED & READY TO EXECUTE**.
