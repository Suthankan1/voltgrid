# 1. Human Identity and External OIDC Provider

## Context
VoltGrid is evolving from a trusted local prototype into a commercial multi-tenant EV charging platform operating in Sri Lanka. In previous iterations, operator interfaces and backend GraphQL services operated without human authentication, trusting network proximity and local access. Commercial operations require strong human identity verification, single sign-on (SSO), multi-factor authentication (MFA), and lifecycle governance for operators, administrators, technicians, and partners.

## Security Problem
Lacking human identity verification allows anonymous or unauthorized actors to query station topologies, inspect charging sessions, execute station registrations, or tamper with station configurations. Custom credential databases for human users introduce high risk of credential exposure, weak password hashing, lack of MFA, credential stuffing vulnerabilities, and compliance liabilities.

## Alternatives Considered
1. **Custom Human Authentication (Database-backed username/password)**:
   - *Pros*: Simple initial setup without external dependencies.
   - *Cons*: High implementation risk (password hashing, salts, rate limiting, password reset flows, MFA, session management), regulatory non-compliance, vulnerable to credential theft.
2. **Proprietary Cloud-Locked IdP (e.g., AWS Cognito exclusive lock-in)**:
   - *Pros*: Managed infrastructure in AWS.
   - *Cons*: Incompatible with local air-gapped development and automated offline CI; vendor lock-in contradicts standards-based platform portability.
3. **Standards-compliant OIDC with External Provider (Keycloak / Standards-compliant OIDC IdP)**:
   - *Pros*: Strict compliance with OpenID Connect (OIDC) Core 1.0 and OAuth 2.0 Authorization Framework (RFC 6749, RFC 7636 PKCE). Portable across local development (containerized Keycloak / lightweight OIDC test fixture) and cloud deployments (Cognito, Auth0, Okta, or self-hosted Keycloak). Spring Security OAuth2 Resource Server provides native, battle-tested JWT validation.

## Selected Approach
Adopt standards-compliant **OpenID Connect (OIDC)** using the **OAuth 2.0 Authorization Code Flow with PKCE** (Proof Key for Code Exchange) for human operators. Backend services (`station-service`, `operations-service`) operate as **OAuth2 Resource Servers** validating cryptographically signed JSON Web Tokens (JWT) using JSON Web Key Sets (JWKS) retrieved from the configured OIDC issuer.

Human identities are keyed by the tuple `(issuer, subject)` to ensure stability across email address updates. Local development and automated testing utilize a containerized/embedded standards-compliant OIDC mock/Keycloak fixture without paid cloud dependencies.

## Rationale
- Standards compliance prevents vendor lock-in while leveraging Spring Security's battle-tested `spring-security-oauth2-resource-server`.
- Decouples user password management, MFA enforcement, and identity federation from core charging business logic.
- Enables cryptographic verification of JWT signatures, expiration (`exp`), not-before (`nbf`), issuer (`iss`), and audience (`aud`).

## Trade-offs
- Requires external network resolution or local mock discovery endpoints during startup/verification.
- Token expiration requires graceful session refresh handling via Next.js Backend-For-Frontend (BFF).

## Trust Boundaries
- **Browser <-> Next.js BFF**: Authenticated via secure, HttpOnly, SameSite session cookies; access/refresh tokens are never exposed to browser JavaScript.
- **Next.js BFF <-> OIDC Provider**: Communicates over TLS using confidential client credentials to exchange authorization codes for tokens.
- **Next.js BFF <-> Backend Resource Servers**: Bearer JWT passed in `Authorization` header. Resource servers independently verify signatures against IdP JWKS.

## Failure Behavior
- If IdP is unreachable and cached JWKS keys are expired, backend calls fail closed (HTTP 401 Unauthorized).
- Invalid, expired, unsigned, wrong-issuer, or wrong-audience tokens are unconditionally rejected.

## Migration Implications
- Existing local development without auth transitions to using a local OIDC profile or developer test tokens.
- No human user data exists in the database to migrate; all operator accounts originate from the IdP.

## Operational Implications
- Operator management (onboarding, password resets, MFA enrollment) is managed in the IdP.
- Keys rotated by the IdP are automatically retrieved by Spring Security's `NimbusJwtDecoder` JWKS refresh logic.

## Testing Strategy
- Unit and slice tests using `@WithMockUser` and `jwt()` mock decoders.
- Integration tests using an embedded JWKS server (`MockWebServer`) issuing signed test JWTs with positive and negative test cases (expired, bad signature, wrong issuer, wrong audience, unsupported algorithm).

## Remaining Dependencies
- Production identity provider selection and DNS/TLS setup (deferred to VG-203 infrastructure milestone).
