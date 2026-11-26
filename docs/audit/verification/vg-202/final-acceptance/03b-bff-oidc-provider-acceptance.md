# VG-202R.3C BFF OIDC provider acceptance

The verified base was `b5ec919bbd098933f0b9c4abeaa101e09bdd553f` on origin/main after PR #70. The Station and Operations HTTP matrices previously passed 26 cases each, with seven additional decoder tests per service. [VG-202R.3B evidence](03a-jwt-http-acceptance.md)

## BFF policy

The operator BFF discovers one configured issuer through openid-client 6.9.1. Authorization, token and JWKS endpoints must be present and use HTTPS. Explicit local mode permits HTTP on the same loopback origin as the issuer. An issuer configuration must identify the provider, and the metadata issuer must match it. Discovery and token requests use the supported five-second timeout. Failed discovery clears the cached promise so the next attempt can retry. [openid-client discovery API](https://github.com/panva/openid-client/blob/v6.9.1/docs/functions/discovery.md)

jose 6.2.18 verifies the RS256 signature against the discovered JWKS and validates issuer, API audience, expiration, optional not-before and the bound nonblank subject. The selected Keycloak configuration requires the signed payload claim `typ` to equal `Bearer`. Station and Operations enforce the same purpose policy. The JOSE header type can be `JWT`. [jose remote JWKS API](https://github.com/panva/jose/blob/v6.2.18/docs/jwks/remote/functions/createRemoteJWKSet.md)

The login handler issues an opaque handle for a five-minute record with random state, nonce and S256 PKCE verifier. The callback consumes the record before external work, constructs its URL from the configured application origin, uses openid-client for exchange and ID-token validation, verifies the access token with jose, and checks Station membership before allocating a session. A failure returns a generic private, no-store 401 and expires any presented login cookie.

## Controlled acceptance matrices

The cases below run in [oidc-provider.test.mjs](../../../../../apps/operator-web/tests/oidc-provider.test.mjs). Test names carry the corresponding IDs. The loopback provider publishes public JWKs for ephemeral signing keys. Callback tests call the production Next.js route handlers with NextRequest and use the real token exchange library, verifier and session store. The HTTP Station fixture checks the verified bearer token and organization ID, then returns a controlled membership or dependency response.

| Cases | Verification | Result |
| --- | --- | --- |
| BFF-JWT-01–06 | Valid bearer, malformed input, invalid signature, changed payload, unsigned input, unpublished key | Passed |
| BFF-JWT-07–12 | Wrong issuer, wrong or missing audience, expired or missing expiration, future activation | Passed |
| BFF-JWT-13–18 | Missing, blank and mismatched subject, HS256, RS512, unknown key ID | Passed |
| BFF-JWT-19–22 | ID purpose, refresh purpose, missing purpose, token-supplied key URL ignored | Passed |
| JWKS-01–04 | Initial key, published replacement after cooldown, unpublished replacement, retired key before and after refresh | Passed |
| JWKS-05–08 | Warm cache during outage, unknown key and expired token during outage, recovery | Passed |
| PROVIDER-01–05 | Login and discovery, discovery HTTP failure, malformed response, issuer mismatch, initial JWKS outage | Passed |
| PROVIDER-06–10 | Token HTTP failure, malformed body, timeout, invalid access token, discovery retry and recovery | Passed |
| OIDC-01–06 | Verified session, missing cookie, unknown and expired records, missing and wrong state | Passed |
| OIDC-07–12 | Consumed record, missing code, invalid and used code, incomplete login, incorrect PKCE verifier | Passed |
| OIDC-13–18 | Wrong nonce, missing ID token, bad ID signature, subject mismatch, provider denial, token endpoint failure | Passed |
| OIDC-19–24 | Invalid access token, duplicate parameters, membership denial and dependency failure, fixed destination, simultaneous callbacks | Passed |

Discovery cases also exercise absent JWKS, authorization and token endpoints, insecure remote JWKS, and HTTP issuer rejection with local mode disabled. The callback harness checks one-time consumption, generic errors, no session allocation on failure and the Station request contents. It verifies the code exchange redirect and PKCE challenge. Real Keycloak supplies the confidential-client and registered redirect evidence.

The production jose defaults use a ten-minute freshness period, a 30-second cooldown after successful fetch and a five-second JWKS request timeout. An unknown key triggers a reload after cooldown. A cached key can still verify tokens while the cache is fresh, including during a temporary outage. Refresh can remove a retired key before the cache expires if an unknown key triggers a reload. Once the cache expires, verification requires a successful reload. The test advances the clock with Node's Date mock.

## Corrections and review

| Source | Finding from source and installed-library review | Verification |
| --- | --- | --- |
| `apps/operator-web/src/lib/oidc.ts` | The signature and claims checks omitted the Keycloak bearer purpose and could match a blank subject. The BFF now checks both after signature verification. | BFF-JWT-14, 19–21 |
| `apps/operator-web/src/lib/oidc.ts` | Discovery could cache incomplete authorization metadata. Local mode enabled HTTP for library requests generally, and direct discovery-document configuration selected a library path that skipped its issuer comparison. The BFF now validates endpoints and issuer before caching the provider. The library discovery and grant timeout is explicitly five seconds. | PROVIDER-02–04, 08, 10 and metadata subtests |
| `apps/operator-web/src/app/api/auth/callback/route.ts` | An incomplete record could omit library checks. The route now requires populated state, nonce and verifier, rejects repeated query names and expires presented login cookies on failure. | OIDC-11, 20 and failure invariants |

A separate reviewer inspected the production code, installed library behavior, fixture and workflow. Review improvements included explicit discovery-document rejection, observing actual token fixture outcomes and checking the credential and organization ID forwarded to Station. Defect identification used source review. The recorded acceptance results are from patched code.

## Commands and CI

Run from `apps/operator-web` using Node 24 or later and the pinned pnpm 12.4.2.

| Command | Local result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed |
| `pnpm test` | 229 passed, zero failures or skips |
| `pnpm lint` | Passed |
| `pnpm exec tsc --noEmit` | Passed |
| `pnpm build` | Passed |
| `pnpm test:e2e` | 36 Chromium tests passed with Keycloak and the GraphQL fixture |
| `pnpm test:a11y` | One Chromium accessibility test passed |

The [Operator Web workflow](../../../../../.github/workflows/operator-web-ci.yml) executes the controlled fixture through `pnpm test`, then starts real Keycloak for the authenticated Chromium and accessibility suite and the cross-browser job. It tears down the Keycloak fixture on completion. [Operator Web workflow runs](https://github.com/Suthankan1/voltgrid/actions/workflows/operator-web-ci.yml)

The initial Linux run reached the controlled provider suite and failed
because the test resolver recursively resolved `next/server` on Node 26.
The fixture now resolves the package path before installing its module hook.
[Initial workflow run](https://github.com/Suthankan1/voltgrid/actions/runs/45848730195)
[PR head checks](https://github.com/Suthankan1/voltgrid/pull/71/checks)

## Real Keycloak and Station

`node integration-tests/oidc/operator-session.mjs` passed with the
production BFF build, local Keycloak 26.8.2, and the disposable Station
database seeded from `organizations.sql`. It passed first with the prior
VG-202R.2 Station fixture image, then with Station rebuilt from the branch. The browser authenticated as
the registered operator, landed at the configured application origin and
received an opaque HttpOnly session with the Station-authorized
`ORG_OWNER` role. The journey also observed role and station changes on
organization switch, logout and cross-organization denial. The controlled
matrix supplies the granular PKCE, nonce, state and ID/access-token binding
evidence for the same BFF routes.

## Remaining scope

VG-202R.3D covers the complete browser session lifecycle, including refresh and logout races, session capacity and restart. Direct server actions, broader redirects, comprehensive cookie and cache behavior, secure startup and tenant authorization belong to subsequent slices. Backend JWT HTTP suites remain unchanged and were not rerun for this frontend-only change. Full independent VG-202 release acceptance remains open.
