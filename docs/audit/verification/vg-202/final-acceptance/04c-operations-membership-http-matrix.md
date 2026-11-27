# VG-202R.4 Operations membership HTTP matrix

On 2026-11-27, this slice was verified from main `2e6c1fd6dff2e41e64427b20c7c8bd598b5643bf` on `verification/vg-202r4-operations-membership`. It runs the real Operations HTTP authentication filter, signed RS256 bearer tokens, GraphQL, and disposable PostgreSQL projections under two organizations. The Station membership endpoint is a controlled HTTP dependency.

| Criterion | Evidence |
| --- | --- |
| Operations checks membership on the first request after revocation with the same unexpired token | Station fixture returns 403. Operations returns 403, performs exactly one Station lookup, invokes zero GraphQL requests, and returns no projection or token. |
| Station outage and timeout fail closed, then recover | The fixture returns 503 and separately holds the response until the client times out. Both requests return 403 without GraphQL dispatch. The delayed case completes within the five-second test ceiling against the existing two-second read timeout. A subsequent request succeeds once the dependency recovers. |
| Two-tenant projections stay scoped | The authenticated actor reads its station and filtered organization page while a foreign station alias returns null. A persisted foreign projection does not appear in the page. |

Dedicated `mvn -B -ntp -Dtest=OperationsJwtHttpAcceptanceTests,KeycloakAccessTokenPolicyTests test` passed 28 HTTP cases and seven decoder cases. Full `mvn -B -ntp verify` with the existing `VOLTGRID_SECURITY_REQUIRE_AUTH=false` test environment passed 69 tests. Both runs had zero failures, errors, or skips. The dedicated HTTP class explicitly requires authentication.

The integrated real Station, Operations and browser journey is documented in [04d-integrated-membership-lifecycle.md](04d-integrated-membership-lifecycle.md). Full role/tenant field matrix and external gates remain pending. This test-only slice adds no migration, runtime settings, or rollback requirement.
