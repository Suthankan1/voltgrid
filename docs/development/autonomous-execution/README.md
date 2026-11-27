# VoltGrid execution ledger

## 2026-11-27 · VG-202R.3D browser session lifecycle

- **Base** `d9b13c14324a2fd2958fa6a76ce432d2e1bddd38` (`origin/main`). GitHub lists PRs #65–#71 as merged. Operator Web and Security Scanning passed on the main merge of #71.
- **Branch** `remediation/vg-202r3d-session-lifecycle`. This entry is part of the scoped change. Use the PR head and check results for the delivered SHA and CI evidence.
- **Issues** #4 and #12 remain open. This slice addresses opaque handles and refresh lifecycle. The request/configuration matrix (R.3E), membership revocation and downgrade (R.4), live provider MFA/recovery, manual login accessibility, owner merge and the remaining #4 acceptance criteria are outstanding.

| State | Criterion | Evidence and next action |
| --- | --- | --- |
| Verified locally | Missing, unknown, tampered, expired and superseded handles resolve anonymously. Fresh stores have no prior handles, and capacity preserves active sessions. | `tests/auth-and-admin.test.mjs` and `tests/oidc-provider.test.mjs` cover fresh-store behavior, capacity and expiry cleanup, actual callback fixation protection, independent sessions and actual logout. |
| Verified locally | One refresh grant across concurrent requests, rotated token retention, fail-closed refresh, stable absolute expiry, and no session resurrection after logout or expiry. | Controlled provider tests use the BFF session resolver, signed JWTs and real HTTP grants. Logout invalidates locally before provider revocation. Detached records retain the rotated refresh token for revocation while access credentials stay untouched. |
| Verified locally | A response to an earlier organization switch cannot overwrite the refreshed browser context. | The actual switch route returns 409 if the session changed and 401 if it became inactive. Existing Station audit records reflect the backend authorization request. |
| Testing | Real Keycloak browser refresh and logout, browser regression, accessibility and Linux cross-browser verification. | `e2e/session-lifecycle.spec.ts` waits past the isolated realm's 120-second access-token lifetime, checks concurrent session reads and verifies logout invalidation. Verify actual local and final-head CI outcomes before promoting this slice. |

Local verification in `apps/operator-web` used Node 24.22.3 and pnpm 12.4.2. `pnpm install --frozen-lockfile` passed. `pnpm test` passed 236 tests with zero failures or skips. `pnpm lint`, `pnpm exec tsc --noEmit` and `pnpm build` passed. The first offline install lacked a tarball and left local dependency links incomplete. A successful frozen install restored them before rerunning the gates.

Session storage remains process-local. Rolling back to the previous app revision requires no schema or configuration change and clears in-memory sessions when the process restarts. Multi-replica behavior remains under #6. Resume with final-head CI and the outstanding #12 tests, then continue to R.3E and the independent work identified in #64. Retain manual owner review and merge.
