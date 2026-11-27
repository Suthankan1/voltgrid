# VG-202R.3E operator mutation authorization

On 2026-11-27, the mutation slice was implemented on `remediation/vg-202r3e-mutation-guard` atop the browser lifecycle change in PR #72 at `b52adf23a2c9c20a9a73a4511f92f8f51b7581dc`. The shared mutation boundary checks the configured origin and live session and obtains current Station membership before dispatch. Station keeps responsibility for each requested resource and action. Membership service failures deny mutation dispatch, and redirects from the GraphQL endpoint are rejected. No schema change. Rolling back uses the previous BFF revision.

| Criterion | Evidence | Status |
| --- | --- | --- |
| Anonymous, missing/foreign origin, expired session, revoked membership and unavailable membership service cause zero GraphQL mutations | The signed-provider fixture in `tests/oidc-provider.test.mjs` exercises all eight admin mutation functions and station registration against an HTTP fixture. Next request headers and cookies are controlled inputs. | Passed locally |
| Valid operator still dispatches same-origin mutations with access token and server-derived organization | Positive admin mutation fixture and real Keycloak registration through the running Next server | Passed locally |
| Linux final-head CI and owner review | The owner merged #75 into the #72 source branch. Carry its scoped commit onto latest main after #72 and #74 have landed and verify the new head. | Pending |

`pnpm install --frozen-lockfile`, `pnpm test` (238 passed, zero failures or skips), `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build` passed. The targeted Chromium run of `e2e/operator.spec.ts` and `e2e/station-registration.spec.ts` passed all 14 cases against the isolated real Keycloak fixture and GraphQL test service.

On the main-based carry-forward branch, the frozen install, 255 Node tests, lint, type check and production build passed with the startup validation included.

The HTTPS cookie and protected response-cache matrix, real backend membership revoke/downgrade and timing evidence, owner merge, and broader #4/#12 acceptance remain open.
