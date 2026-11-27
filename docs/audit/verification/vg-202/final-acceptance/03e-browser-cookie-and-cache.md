# VG-202R.3E browser cookie and response cache

On 2026-11-27, the verification slice ran from main `05dfe6b0e111f2d35e983b99ffd43ff7c679eb68` on `verification/vg-202r3e-browser-boundary`.

| Criterion | Evidence | Status |
| --- | --- | --- |
| Host-only opaque session cookie, HttpOnly, SameSite=Lax and eight-hour lifetime | Actual OIDC callback response captured by `e2e/browser-security.spec.ts` against the isolated real Keycloak fixture. | Passed in Chromium |
| Secure cookie and logout expiry for HTTPS origin | `tests/browser-cookie-contract.test.mjs` invokes the real logout handler with an HTTPS URL and checks issuance options and the serialized logout cookie. | Passed in Node. This test exercises the application header contract, with no TLS handshake. |
| Protected pages and session responses use private, no-store caching, and unauthenticated context cannot read the active session | The browser test uses independent browser contexts, checks response headers on `/stations` and `/api/auth/session`, and expects the anonymous protected page to redirect. | Passed in Chromium |
| No JWT in tested responses or web storage, and no browser script access to the handle | The browser test checks authenticated page/session bodies, local and session storage, and document.cookie. | Passed in Chromium |
| A foreign origin cannot log out an active session | The actual logout endpoint returns 403 with private, no-store caching. The browser session remains active. | Passed in Chromium |

Frozen install, `pnpm test` (230 cases, zero failures or skips), lint, type check, production build and one targeted Chromium case passed locally. Final-head CI and owner merge are pending. This test-only change has no runtime rollback steps. Full HTTPS deployment verification, the rest of #12 acceptance and VG-202 remain open.
