# VG-202R.3E OIDC startup configuration

On 2026-11-27, the configuration slice was implemented from main `d9b13c14324a2fd2958fa6a76ce432d2e1bddd38` on `remediation/vg-202r3e-oidc-startup`. It shares configuration validation between the Next server startup and OIDC discovery. A syntactically valid configuration allows the server to start independently of IdP availability. Discovery and key failures continue to deny authentication at request time.

| Criterion | Evidence | Status |
| --- | --- | --- |
| Start configured app with HTTPS origin and issuer, or an explicitly selected isolated loopback fixture | `src/lib/oidc-config.mjs`, `next.config.ts`, configuration cases in `tests/oidc-startup.test.mjs` | Local configuration tests passed |
| Reject missing or invalid origin, issuer, audience, client ID and secret, and disallowed compatibility settings | Configuration cases and a real `next start` child process asserting nonzero exit and the expected missing-audience diagnostic | Local tests passed |
| Preserve existing provider and operator flows | Full Node regression, lint, type check and build passed. Browser, accessibility, and Linux cross-browser evidence come from the actual PR checks. | Local gates passed, CI pending |

Run from `apps/operator-web`. `pnpm install --frozen-lockfile`, `pnpm test` (246 passed, zero failures or skips), `pnpm lint`, `pnpm exec tsc --noEmit` and `pnpm build` passed locally. Initial test attempts exposed a local test loader assumption about file extensions and an assertion about Next's startup banner. The corrected startup test asserts process exit and error output. A banner alone does not prove the configuration was accepted.

See the operator README for the required explicit audience and rollback. This slice leaves #4 and #12 open. Follow with the R.3E server-action authorization and request-origin matrix, HTTPS cookie and cache checks, and the R.4 membership lifecycle. Owner review and manual merge are required.
