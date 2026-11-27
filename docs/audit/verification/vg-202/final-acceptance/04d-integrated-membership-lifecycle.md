# VG-202R.4 Integrated membership lifecycle

On 2026-11-27, the end-to-end cross-service membership lifecycle was verified from main `1ad893642125015a2a7fbe24787bbd38ad18da48`. The integrated run exercises the Next.js Operator Web BFF, Keycloak OIDC, Station Service GraphQL, Operations Service GraphQL and PostgreSQL in concert.

## Lifecycle steps and verified evidence

| Step | Action | Expected behavior | Observed result |
| --- | --- | --- | --- |
| 1. Active sign-in & projection | Operator signs in via Keycloak authorization code flow with S256 PKCE. | Initial session established with `ORG_OWNER` in `org_fixture_a`. Station status projection is accessible via Operations GraphQL. | Verified: session reports `["ORG_OWNER"]`, and Operations GraphQL returns `VG-FIXTURE-A-STATION`. |
| 2. Member role downgrade | Fixture administrator (`operator-b`) executes Station GraphQL mutation `updateMemberRole` to downgrade the operator to `SUPPORT`. | Next browser session check immediately reflects `SUPPORT`. Operations projection remains accessible as `SUPPORT` role has `STATION_READ`. | Verified in 9 ms: browser session reports `["SUPPORT"]`. Operations projection returns `VG-FIXTURE-A-STATION`. |
| 3. Member revocation | Fixture administrator executes Station GraphQL mutation `revokeMember` on the operator. | Next browser request detects membership revocation, denies access and clears session. Operations GraphQL immediately denies the still-valid bearer access token. | Verified: browser session denied and invalidated in 9 ms (`{ authenticated: false, user: null }`). Operations GraphQL returns HTTP 403 in 17 ms. |
| 4. Frontend navigation protection | Revoked operator attempts to load protected route `/stations`. | Next.js server redirects to `/login`. | Verified: HTTP 307 redirect to `/login`. |

## Reproduction and execution

The reproducible automated fixture script is located at:
- `integration-tests/oidc/membership-lifecycle.mjs`

To execute against the local test stack:
```sh
node integration-tests/oidc/membership-lifecycle.mjs
```

Timing metrics captured during test execution:
- Browser downgrade propagation: ~9 ms
- Browser revocation invalidation: ~9 ms
- Operations token denial propagation: ~17 ms

This completes the cross-service lifecycle verification requirement for R.4.
