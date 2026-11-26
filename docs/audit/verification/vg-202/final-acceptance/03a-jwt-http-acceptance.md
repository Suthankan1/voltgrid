# VG-202R.3B backend JWT HTTP acceptance

The branch is based on `987fe7232cd708b07e68c09fe1f2ca6fadcee681`, verified
against GitHub `main` after PR #69. This evidence covers the Station and
Operations operator GraphQL authentication boundary.

## Configuration and fixtures

Both suites boot the real application with random-port Tomcat, Flyway and
disposable PostgreSQL 18.6. The tests set `voltgrid.security.require-auth=true`
inside the test context, along with issuer
`https://issuer.example.test/realms/http-acceptance`, audience
`voltgrid-http-acceptance` and a loopback JWKS URL. The normal servlet filter
and Nimbus decoder bean enforce RS256 and the signed Keycloak payload claim
`typ: Bearer`. Each suite generates its own 2048-bit RSA keys in memory and
publishes only the trusted public key at the configured URL. The alternate
endpoint lets the case verify zero lookups to the URL supplied in a JWT
header. Nimbus produces the test signatures.

Station uses a persisted active organization, active operator membership and
station. Operations uses a persisted organization-scoped status projection.
Operations calls a loopback fixture for Station's membership decision. That
fixture checks the request method, organization and synthetic subject.
Operations must authenticate the token before it can call the fixture.

An outer servlet probe verifies the thread-local is empty before and after the
production filter. An inner probe detects entry to the GraphQL dispatch path.
Tests run serially with one Tomcat worker, and the client waits up to five seconds
for the corresponding cleanup observation. The rejection assertions require the
exact HTTP 401 JSON envelope, which excludes protected data and credential
contents. They also require zero downstream dispatches and, in Operations,
zero membership lookups. HTTP whitespace normalization leaves the empty
credential case as `Bearer`, which receives `MISSING_BEARER_TOKEN` on both
services. Successful requests return the expected fixture ID and station name
or current status, with zero GraphQL errors.

The client, local key endpoint and Spring context close after each
suite. Spring owns the disposable database. The test clock is the host clock
used by the production decoder. Tokens expired or premature by 120 seconds
are rejected, while expiration five seconds in the past and not-before 15
seconds in the future are accepted with the configured 30-second skew.
Requests have bounded timeouts. The suites use zero sleeps.

## HTTP results

The method references below apply independently to
`StationJwtHttpAcceptanceTests` and `OperationsJwtHttpAcceptanceTests`.
The 23 negative cases are separate parameterized invocations. The sequence
test verifies both JWT-25 and JWT-26 with valid, anonymous, invalid, then valid
requests. Each class reports 26 invocations including the supplementary skew
test.

| ID | Case | Station | Operations | Method |
| --- | --- | --- | --- | --- |
| JWT-01 | Valid RS256 bearer access token | Passed | Passed | `jwt01ValidRs256ReturnsProtectedData` |
| JWT-02 | Missing Authorization header | Passed | Passed | `jwt02Through24RejectAtAuthenticationBoundary` |
| JWT-03 | Empty bearer credential | Passed | Passed | `jwt02Through24RejectAtAuthenticationBoundary` |
| JWT-04 | Malformed JWT | Passed | Passed | `jwt02Through24RejectAtAuthenticationBoundary` |
| JWT-05 | Invalid signature with trusted key ID | Passed | Passed | `jwt02Through24RejectAtAuthenticationBoundary` |
| JWT-06 | Modified signed payload | Passed | Passed | `jwt02Through24RejectAtAuthenticationBoundary` |
| JWT-07 | Unsigned JWT | Passed | Passed | `jwt02Through24RejectAtAuthenticationBoundary` |
| JWT-08 | Untrusted signing key with caller-supplied key headers | Passed | Passed | `jwt02Through24RejectAtAuthenticationBoundary` |
| JWT-09 | Wrong issuer | Passed | Passed | `jwt02Through24RejectAtAuthenticationBoundary` |
| JWT-10 | Missing issuer | Passed | Passed | `jwt02Through24RejectAtAuthenticationBoundary` |
| JWT-11 | Wrong audience | Passed | Passed | `jwt02Through24RejectAtAuthenticationBoundary` |
| JWT-12 | Missing audience | Passed | Passed | `jwt02Through24RejectAtAuthenticationBoundary` |
| JWT-13 | Expired beyond skew | Passed | Passed | `jwt02Through24RejectAtAuthenticationBoundary` |
| JWT-14 | Missing expiration | Passed | Passed | `jwt02Through24RejectAtAuthenticationBoundary` |
| JWT-15 | Future not-before beyond skew | Passed | Passed | `jwt02Through24RejectAtAuthenticationBoundary` |
| JWT-16 | Missing subject | Passed | Passed | `jwt02Through24RejectAtAuthenticationBoundary` |
| JWT-17 | Blank subject | Passed | Passed | `jwt02Through24RejectAtAuthenticationBoundary` |
| JWT-18 | HS256 | Passed | Passed | `jwt02Through24RejectAtAuthenticationBoundary` |
| JWT-19 | RS512 with trusted RSA key | Passed | Passed | `jwt02Through24RejectAtAuthenticationBoundary` |
| JWT-20 | Unknown key ID with trusted RSA signature | Passed | Passed | `jwt02Through24RejectAtAuthenticationBoundary` |
| JWT-21 | Signed ID token | Passed | Passed | `jwt02Through24RejectAtAuthenticationBoundary` |
| JWT-22 | Signed refresh token | Passed | Passed | `jwt02Through24RejectAtAuthenticationBoundary` |
| JWT-23 | Missing signed token type | Passed | Passed | `jwt02Through24RejectAtAuthenticationBoundary` |
| JWT-24 | Historical development token | Passed | Passed | `jwt02Through24RejectAtAuthenticationBoundary` |
| JWT-25 | Valid token after invalid request | Passed | Passed | `jwt25And26IsolateConsecutiveRequests` |
| JWT-26 | Anonymous request after valid request | Passed | Passed | `jwt25And26IsolateConsecutiveRequests` |

## Defects and corrections

No production authentication defect was confirmed. The initial Station positive
control reached the real tenant check and returned a GraphQL error because the
fixture used `OWNER`, which is outside Station's role enum. The corrected
fixture uses the real `OPERATOR` role and exercises the actual membership and
query path. Both filters already clear the context in a `finally` block if
downstream processing throws. The HTTP suite verifies cleanup after successful
and rejected requests.

## Local gates

Local runtime used OpenJDK 25.0.4.1, Maven 3.9.16, Docker Engine 29.9.3,
Spring Boot 4.1.1 and PostgreSQL 18.6.

| Command | Tests | Failures | Errors | Skips |
| --- | ---: | ---: | ---: | ---: |
| `mvn -B -o -f services/station-service/pom.xml -Dtest=StationJwtHttpAcceptanceTests,KeycloakAccessTokenPolicyTests clean test` | 33 | 0 | 0 | 0 |
| `mvn -B -o -f services/operations-service/pom.xml -Dtest=OperationsJwtHttpAcceptanceTests,KeycloakAccessTokenPolicyTests test` | 33 | 0 | 0 | 0 |
| `VOLTGRID_SECURITY_REQUIRE_AUTH=false VOLTGRID_OCPP_AUTH_REQUIRED=false AUTHORIZATION_GRPC_TLS_ENABLED=false mvn -B -o -f services/station-service/pom.xml verify` | 240 | 0 | 0 | 0 |
| `VOLTGRID_SECURITY_REQUIRE_AUTH=false mvn -B -o -f services/operations-service/pom.xml verify` | 67 | 0 | 0 | 0 |
| `mvn -B -o -f services/authorization-service/pom.xml verify` | 30 | 0 | 0 | 0 |
| `mvn -B -o -f integration-tests/authorization-flow/pom.xml verify` | 4 | 0 | 0 | 0 |

The dedicated runs include seven existing Keycloak decoder tests per service,
covering token purpose, JWKS replacement, warm-cache outage, expiration and
recovery. The broad Station and Operations commands use the existing CI
compatibility settings for legacy tests. The HTTP test contexts still require
authentication. The authorization-flow harness starts Station with its
existing local service compatibility arguments. The flow run used an isolated
copy of the committed source at `4e16019901820fd1d6d5e208428519a181f6e802`.

## CI and review

Station Service CI and Operations Service CI run the HTTP and Keycloak suites
in a dedicated Maven step. The earlier workflow steps retain their
step-scoped compatibility environment. The secure suites use in-memory keys
and the existing workflow and request timeouts.

Final-head Actions results appear in the [workflow runs for this branch](https://github.com/Suthankan1/voltgrid/actions?query=branch%3Aremediation%2Fvg-202r3b-jwt-http-acceptance) and the pull request checks.

A separate review agent verified the production filter and decoder wiring,
claim isolation, RSA key selection and token purpose, timestamp offsets,
PostgreSQL fixtures, servlet cleanup synchronization and CI selection.
The review confirmed that RS512 uses the trusted RSA key to isolate algorithm
policy. The HS256 case establishes rejection under the deployed asymmetric
trust configuration. The review identified a potential response-versus-filter
completion race in the first implementation, which the bounded wait removed.
The reviewer reported no remaining blocking findings.

The Operations membership lookup is a local fixture. The HTTP suites cover
operator GraphQL authentication with Keycloak-shaped signed claims and local
JWKS. Broader provider and browser/session evidence remains tracked in
[authentication verification](03-authentication-and-session-verification.md).
