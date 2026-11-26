# VG-202R.3 authentication evidence

**Partial.** Baseline `f2221ab910ba754e82dd584efff631abd6c62d00` merges PR #68 at head `1a95122fb37dcd32a1968ac7d869dd7b4efa6e63`. The earlier remediation arrived through PRs #66 and #67. This evidence covers the Java JWT decoders and does not establish full VG-202 acceptance.

## Trust boundaries reviewed

| Boundary | Baseline and policy |
| --- | --- |
| Keycloak to Station and Operations | Each service configures one issuer, one JWKS URL and one dedicated audience. Spring Security and Nimbus verify the signature and apply issuer, audience, nonblank subject, required expiration and 30-second timestamp skew. This change pins RS256 explicitly and requires the signed Keycloak access-token type. |
| Identity to membership | Station uses the verified subject as the membership key. Email is display data. The single issuer is enforced by both Java decoders. Station can recognize the provider-issued platform administrator role from the signed roles claim, so role assignment must be restricted at the provider. Operations delegates organization authorization to Station. |
| Browser to Keycloak and callback | The BFF uses openid-client discovery and authorization code exchange. The login transaction holds state, nonce and an S256 PKCE verifier and expires after five minutes. The callback consumes the server-side record and uses the configured application origin. |
| Provider to BFF | The BFF uses jose to verify RS256, issuer, audience, subject and expiration against discovered JWKS. It binds the access token to the ID token subject during login and checks organization access with Station. |
| Browser to BFF | The cookie carries an opaque random 256-bit session handle. HttpOnly, SameSite Lax and host scope are configured with path `/`. The Secure attribute is enabled for HTTPS and local HTTP requires explicit loopback configuration. The store rejects new records at capacity after reclaiming expired entries. |
| Session lifecycle | The process-local store holds reusable tokens. The application session has an eight-hour lifetime. Refresh starts near access-token expiry and shares one in-flight promise per session. Logout deletes the record before attempting refresh-token revocation. The provider SSO session can persist. A process restart clears local state. Multi-replica operation depends on VG-204. |
| Compatibility | Java operator authentication defaults on. Service CI uses isolated compatibility settings for existing regression suites and runs the new decoder tests separately. Both focused tests instantiate the production decoder with authentication required. |

## Confirmed Java defect and regression

Both JWT validators accepted an otherwise valid token without checking the signed
Keycloak token purpose. They now require payload `typ` equal to `Bearer` for the
configured Keycloak bearer-token deployment. The JOSE algorithm is constrained to
RS256 through the decoder builder. The policy depends on the [Keycloak 26.8.2 token issuance code](https://github.com/keycloak/keycloak/blob/26.8.2/services/src/main/java/org/keycloak/protocol/oidc/TokenManager.java#L1431).

The focused tests live in `services/{station-service,operations-service}/src/test/java/com/voltgrid/{station,operations}/api/security/KeycloakAccessTokenPolicyTests.java`.
On macOS arm64 with Java 25.0.4.1 and Maven 3.9.16, run from the repository root:

```sh
mvn -B -o -f services/station-service/pom.xml -Dtest=KeycloakAccessTokenPolicyTests test
mvn -B -o -f services/operations-service/pom.xml -Dtest=KeycloakAccessTokenPolicyTests test
```

| Method | Station | Operations |
| --- | --- | --- |
| `requiresKeycloakBearerAccessTokenType` | Accepted Bearer. Denied ID, Refresh, missing and empty type. | Same five cases passed. |
| `acceptsReplacementKeyWithoutRestartingDecoder` | Accepted the initial key and replacement on the same decoder. Rejected the initial key after refresh to the replacement set. | Same outcome. |
| `usesCachedKeyDuringOutageAndRecoversWhenJwksReturns` | During a JWKS HTTP 503, accepted a warmed-key token, rejected an expired token and rejected an unpublished key. Accepted the replacement after publication and endpoint restoration. | Same outcome. |

Seven tests passed in each service with zero failures, errors or skips at
`c263a1cd425f634652ca10af5facbb5b4ad00558`. An earlier Station regression
using the same type cases with a pinned public key ran before the correction.
It reported four failures in five tests. The final fixture publishes generated
public JWKs on an ephemeral loopback port and exercises production decoder
construction. Immediate key retirement, cache duration, timeout and retry
behavior require additional evidence.

## Review and remaining acceptance

A second agent reviewed the Java policy, the Keycloak source and the final JWKS
fixtures. It found no blocking defect in that diff. Review scope was the Java
decoder changes and tests. This evidence leaves the full Station and Operations
GraphQL HTTP matrices, real Keycloak issuance through both services, BFF key
rotation, discovery and token endpoint failures, callback failures, secure
startup, session refresh races, cookie properties, restart, capacity, direct
mutation authentication, CSRF, redirects and cache enforcement open.

The protected route inventory includes overview, stations, station detail,
registration, sessions, session detail, attention, diagnostics, administration,
organizations, members, device credentials and audit. The shared operator layout
resolves a session. Route-by-route denial, action invocation, and confirmation
that invalid requests produce zero backend mutations require separate evidence.

## Local quality gates

| Command | Result |
| --- | --- |
| Station `mvn -B -o -f services/station-service/pom.xml verify` with the three compatibility settings from Station CI | 214 tests passed, zero failures, errors or skips. |
| `mvn -B -o -f services/authorization-service/pom.xml verify` | 30 tests passed, zero failures, errors or skips. |
| `mvn -B -o -f integration-tests/authorization-flow/pom.xml verify` | Four tests passed, zero failures, errors or skips. |
| Operator `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build` | Frozen installation and all four gates passed. Unit tests reported 172 passed and zero failures or skips. |
| Operator `pnpm audit` | No known vulnerabilities reported. |
| `git diff f2221ab --check` and added-line scan for PEM private keys and common credential patterns | No matches or whitespace errors. No historical migration changes. |

The initial in-sandbox Maven runs could not reach the Docker daemon. An approved
retry reached Docker. Full Station and Operations runs without fixture settings
reported missing issuer and JWKS configuration in legacy test contexts. The
secure decoder tests set their own isolated issuer and JWKS endpoint.

## Authenticated browser and HTTP acceptance

The local run of the [authentication acceptance journey](../../../../../integration-tests/oidc/authentication-acceptance.mjs)
used Chromium, the production BFF build, Keycloak 26.8.2, packaged Station and
Operations services with authentication required, PostgreSQL 18.6 and Kafka
4.2.1. It used synthetic station and projection records in disposable databases.

- Both GraphQL endpoints returned HTTP 401 without protected data for missing,
  empty, malformed and historical development bearer tokens.
- Anonymous direct HTTP requests to all 13 inventoried operator routes
  redirected to login. The responses contained no seeded station data.
- Login used a fixed callback, authorization code flow and S256 PKCE. The
  callback rejected missing login context and provider denial.
- Real Keycloak sign-in produced an opaque HttpOnly, SameSite Lax browser
  handle. The browser displayed seeded data from both APIs.
- Both logout and organization switching returned HTTP 403 for a foreign
  origin while the authenticated session remained active.

Operations `VOLTGRID_SECURITY_REQUIRE_AUTH=false mvn -B -o -f services/operations-service/pom.xml verify`
passed 41 tests with zero failures, errors or skips. With Keycloak and fixture
GraphQL, `pnpm test:e2e` passed 36 cases and `pnpm test:a11y` passed one.
`pnpm test:e2e:cross-browser` passed 36 Chromium and WebKit cases. Firefox
reported 18 launch failures because it could not find its profile directory.

The live journey completed after 122 seconds. The application session and
Operations query remained authenticated beyond the original access-token
lifetime. Logout invalidated the local session, and Chromium remained
unauthenticated after presenting the old handle. The full refresh race,
production cookie, provider failure, callback and direct action matrices
remain open.

## VG-202R.3B signed JWT HTTP evidence

The backend HTTP matrices exercise the actual application filters, production
RS256 decoder configuration, signed token purpose and authorized GraphQL
queries. The earlier live Keycloak and browser evidence above covers a
separate slice. [Backend JWT HTTP acceptance](03a-jwt-http-acceptance.md)
