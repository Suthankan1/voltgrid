# VG-202R.4 Station membership HTTP matrix

On 2026-11-27, this slice was verified from main `2e6c1fd6dff2e41e64427b20c7c8bd598b5643bf` on `verification/vg-202r4-station-memberships`. The Station schema inventory still has 24 Station top-level fields and two Operations fields. The scoped case exercises the Station membership path with a real PostgreSQL fixture and RS256 tokens accepted by the production HTTP authentication filter.

| Criterion | Evidence |
| --- | --- |
| Tenant scope applies across GraphQL aliases | One signed administrator can read Organization A's own station and receives null for the foreign station requested under A. An owner without B membership is denied explicitly requesting B. |
| Current roles and membership govern existing bearer tokens | An active administrator creates a site. After an owner downgrades the membership, the same unexpired token is denied a second create and still reads the allowed station. The downgraded user cannot self-promote. |
| Revocation applies on the next HTTP request | The owner revokes membership over GraphQL. The same unexpired token is denied Organization A on the next request, with no sleeps or refresh. The same caller can still use the independent B membership. This verifies a next-request bound in Station, with no production latency claim. |
| Changes are auditable and denied writes leave state intact | Station returns both expected membership audit event types for the actor. The organization site list includes only the authorized create. |

Secure-mode `mvn -B -ntp -Dtest=StationJwtHttpAcceptanceTests,KeycloakAccessTokenPolicyTests test` passed 34 tests (27 HTTP and seven decoder), zero failures, errors, and skips. Station `mvn -B -ntp verify` with the established CI fixture environment passed 243 tests, zero failures, errors, and skips. The dedicated HTTP class explicitly requires authentication. No schema or runtime configuration changes.

The full two-tenant field, role, filter and pagination matrix, historical mapping and replay, and external gates stay open. The integrated live BFF, Station, and Operations membership journey is documented in [04d-integrated-membership-lifecycle.md](04d-integrated-membership-lifecycle.md).
