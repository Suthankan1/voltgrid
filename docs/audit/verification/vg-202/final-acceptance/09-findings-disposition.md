# Findings disposition

This update retains the prior remediation record as historical evidence. “Partially resolved” means the implementation has relevant controls, with acceptance evidence or implementation work outstanding.

| Finding | Current implementation | Evidence reviewed in VG-202R.2 | Disposition | Outstanding evidence or dependency |
| --- | --- | --- | --- | --- |
| IAM-001 | Station and Operations validate issuer, audience, expiration, subject and asymmetric JWKS signatures. | Existing suites ran locally. | Partially resolved | Signed-token HTTP matrix, token type, key rotation and provider outage. |
| IAM-002 | Operator protected layout resolves a server-side session. | Chromium operator fixtures passed. | Partially resolved | Direct server actions and complete authenticated session boundary cases. |
| IAM-003 | Keycloak authorization code, state, nonce and PKCE. | Real Keycloak was used by operator browser tests with fixture GraphQL. | Partially resolved | Callback and provider failure matrix. |
| IAM-004 | Bounded opaque in-process sessions, expiry, refresh and logout. | Operator unit tests and browser fixtures passed. | Partially resolved | Restart, saturation, refresh races and active membership revocation. Multi-replica design belongs to VG-204. |
| IAM-005 | Operations verifies membership at Station and reads organization-scoped projections. | Historical projection and receipt retention passed. | Partially resolved | Dependency failures, authenticated negative cases and authoritative event replay. |
| IAM-006 | Station and transaction resolvers check tenant and operation permissions. | Current GraphQL fields inventoried. Existing resolver tests passed. | Partially resolved | Real two-tenant query, mutation, filter, pagination and site matrix. |
| IAM-007 | Active membership governs destination permissions. Membership writes are serialized and preserve a final active owner. | Real PostgreSQL controller tests verified owner handoff, revocation, concurrent removal and success audit outcomes. | Partially resolved | Live browser and Operations revocation, suspension, downgrade and propagation bound. |
| IAM-008 | Station historical assignments are quarantined. Offline preparation enables V15 to preserve long IDs with canonical Flyway history. | PostgreSQL verified fresh, historical, recovery and repeated migration as well as Operations projection preservation. | Partially resolved | Explicit approved ownership assignment and replay verification. Superuser maintenance is required for the supplied long-ID path. |
| IAM-009 | Per-station credentials use stored hashes and session invalidation on committed credential changes. | Existing Station tests ran. | Partially resolved | Authentication throttling, cost and device concurrency evidence, production WSS and supported hardware. Distributed fencing belongs to VG-204. |
| IAM-010 | Configured internal service identity and profile-dependent gRPC TLS. | The local authorization-flow suite passed. | Partially resolved | Running-server negative matrix, identity allowlists and VG-203 transport. |
| IAM-011 | Versioned HMAC fingerprints and configured key material. | Authorization Maven tests passed. | Partially resolved | Operational key retirement, live compatibility and production injection review. |
| SEC-001 | OCPP handshake requires station-bound credentials in secure mode. | Existing Station coverage passed under its published compatibility harness. | Partially resolved | Secure live matrix and device safeguards in IAM-009. |
| SEC-002 | Station and Operations token validation, organization checks, and gRPC service authentication. | Existing backend suites and authorization flow passed locally. | Partially resolved | Remaining IAM-001, IAM-005 to IAM-007 and IAM-010 evidence. |
| SEC-003 | Authorization uses injected versioned HMAC keys. | Existing Authorization tests passed. | Partially resolved | IAM-011 operational verification. |
| DATA-001 | Station and Operations support long identifiers through their migration paths. | PostgreSQL verified Station IDs up to 255 characters across pre-V15 and Operations projection width through V5. | Verified resolved for the database width path | Application-wide identifier boundary coverage and Operations replay are separate evidence. |
| Final owner protection | Membership writes serialize on the organization row and reject the final active owner's revocation or downgrade. | PostgreSQL tested two competing removals and verified the committed result and audit event. | Verified resolved for current membership mutations | Future suspension or bulk membership writers must observe the same invariant. |
| Administrative audit | Success events join administrative mutations and V17 rejects row rewrites, deletes and truncation. | PostgreSQL verified the trigger and the membership outcomes above. | Partially resolved | Full event coverage, denied actions, redaction, runtime role separation and ADM-02 retention. |

VG-202R.3 verifies the Keycloak access-token type policy and controlled JWKS
rotation, warm-cache outage behavior and recovery at the Station and Operations
decoders. IAM-001 remains partially resolved pending both HTTP matrices and
remaining provider evidence. IAM-002 through IAM-004 remain partially resolved.
[Authentication verification](03-authentication-and-session-verification.md)
