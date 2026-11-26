# 2. Operator Browser Session Architecture

## Context
The VoltGrid operator interface (`apps/operator-web`) is built with Next.js (App Router, Server Components, and Server Actions). Operator sessions require secure interaction with backend GraphQL services without exposing sensitive OAuth tokens to client-side scripts.

## Security Problem
Storing JWT access tokens or refresh tokens in browser storage (`localStorage` or `sessionStorage`) exposes them to Cross-Site Scripting (XSS) extraction. Passing bearer tokens from client-side JavaScript also allows client-side tampering, token replay, and makes revocation tracking difficult.

## Alternatives Considered
1. **Single Page App (SPA) Direct Token Handling**:
   - *Pros*: Simple client-only architecture.
   - *Cons*: Vulnerable to XSS token theft; refresh tokens stored in browser; no secure server-side session state.
2. **Backend-For-Frontend (BFF) Encrypted Session Cookie**:
   - *Pros*: Access and refresh tokens remain strictly on the Next.js server side. The browser holds only an encrypted, `HttpOnly`, `SameSite=Lax`, `Secure` session cookie. Next.js Server Components and Server Actions attach the bearer token when proxying requests to backend services.
   - *Cons*: Next.js server must maintain or decrypt session state and handle token refresh cycles.

## Selected Approach
Implement a **Backend-For-Frontend (BFF) session architecture** in Next.js:
- The browser authenticates via standard OIDC redirect to the IdP.
- The authorization code callback is processed entirely on the Next.js server.
- Tokens (ID token, Access token, Refresh token) and active organization context are stored in an encrypted server-managed session cookie (`voltgrid_session`), marked `HttpOnly`, `SameSite=Lax`, and `Secure` (in non-local environments).
- Server Actions and Server Components read the session, attach the `Authorization: Bearer <jwt>` and `X-Tenant-Id: <orgId>` headers to internal GraphQL calls.
- Browser JavaScript never has access to raw OAuth tokens.

## Rationale
- Completely eliminates XSS token extraction vectors.
- Aligns with Next.js 14/15/16 App Router security best practices.
- Centralizes token refresh, session timeout, and organization switching on the trusted server side.

## Trade-offs
- Server-side cookie encryption requires an encryption secret (`SESSION_SECRET`).
- Next.js server must be treated as a confidential client.

## Trust Boundaries
- **Browser <-> Next.js Server**: Protected by encrypted HttpOnly cookie and CSRF protection on mutating actions.
- **Next.js Server <-> Backend Services**: Internal bearer token propagation; backend services remain authoritative and independently validate token claims and permissions.

## Failure Behavior
- If session cookie is missing, expired, or tampered with, server actions and routes redirect to `/login` or return an unauthorized error.
- If backend returns 401 Unauthorized due to token expiration, the BFF attempts token refresh using the stored refresh token; if refresh fails, session is cleared and user is redirected to login.

## Migration Implications
- Operator web routes transition from open public access to authenticated session checks.
- A bypass flag (`NEXT_PUBLIC_AUTH_DISABLED=true`) is explicitly reserved for isolated UI unit testing only and rejected in production configurations.

## Operational Implications
- Session secret rotation requires a dual-key decryption strategy or graceful user re-authentication.

## Testing Strategy
- Automated unit tests for session encryption, decryption, tampering detection, and expiration.
- Playwright E2E tests verifying redirect to login, callback processing, session cookie flags, and logout.

## Remaining Dependencies
- None. Fully implementable within `apps/operator-web`.

## Current implementation

The operator cookie contains an opaque session handle. Access and refresh tokens
live in a bounded in-process store. The handle lifetime is eight hours, and a
process restart clears all sessions. Logout invalidates the application handle
before attempting refresh-token revocation. Keycloak can retain its own SSO
session. A deployment with multiple operator processes depends on the shared
session design tracked under VG-204.
