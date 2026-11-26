# Identity Provider (IdP) Evaluation

## 1. Overview
As part of milestone **VG-202 (Commercial Identity, Authentication, Authorization and Multi-Tenant Security Foundation)**, this document evaluates suitable OpenID Connect (OIDC) identity providers for VoltGrid.

The objective is to establish a standards-compliant identity architecture supporting:
- Single Sign-On (SSO) and standards-compliant OAuth 2.0 / OIDC flows for human operators.
- Authorization Code Flow with Proof Key for Code Exchange (PKCE).
- Multi-factor authentication (MFA).
- Portable local development and automated CI testing without cloud dependencies or paid software.
- Seamless production deployment on AWS without proprietary vendor lock-in.

---

## 2. Evaluation Matrix

| Criteria | Keycloak (Containerized / Cloud) | AWS Cognito | Auth0 (Okta) | Local OIDC Mock / Test Fixture |
| :--- | :--- | :--- | :--- | :--- |
| **OIDC / OAuth2 Compliance** | Full (OIDC Core 1.0, RFC 7636 PKCE, RFC 6749) | Mostly compliant (some non-standard token quirks) | Full (Strict standards compliance) | Lightweight OIDC test compliance |
| **PKCE & Auth Code Flow** | Native support | Native support | Native support | Emulated for testing |
| **MFA Support** | TOTP, WebAuthn, FIDO2, SMS | TOTP, SMS | TOTP, WebAuthn, Push, SMS | Not needed for local tests |
| **Session & Token Management** | Fine-grained session timeout, revocation API | Fixed token refresh limits | Dynamic session revocation | Ephemeral in-memory |
| **Multi-Tenancy / Organizations** | Realms / Organizations feature | User Pools / Groups | Organizations feature | Multi-tenant test fixtures |
| **Local Development Feasibility** | High (runs in Docker Compose) | Very poor (requires AWS connection or LocalStack Pro) | Poor (requires live internet and test tenant) | Excellent (zero dependencies, instant startup) |
| **Automated CI Integration** | Good (containerized) | Poor (cloud dependencies, flaky CI) | Poor (rate limits, paid tiers) | Outstanding (embedded MockWebServer / WireMock) |
| **Operational Complexity** | Moderate (Postgres-backed container) | Low (fully managed) | Low (fully managed) | Zero |
| **Cost** | Open source (zero software licensing) | Free tier, then per MAU | Costly per MAU / enterprise features | Free |
| **Vendor Lock-in Risk** | Low (standard OIDC, self-hostable) | High (tightly coupled to AWS SDKs) | Moderate (proprietary rules/actions) | None |

---

## 3. Recommended Approach

### Development & Automated Testing
- **Local Testing & CI**: Use a lightweight, standards-compliant **Local OIDC Test Fixture** (embedded mock OIDC / WireMock / MockWebServer issuing signed RSA256 JWTs matching discovery `.well-known/openid-configuration` and `jwks.json`).
- **Local Interactive Development**: Provide an optional containerized **Keycloak** service in Docker Compose (`infrastructure/local/keycloak/compose.yaml`) with a preconfigured VoltGrid realm for end-to-end interactive login testing.

### Production Readiness
- In production on AWS, VoltGrid can integrate either with a managed Keycloak instance on AWS ECS/EKS or Amazon Cognito configured as a generic OIDC provider. Because backend services use standard Spring Security OAuth2 Resource Server (`spring.security.oauth2.resourceserver.jwt.issuer-uri`), switching providers requires **zero code changes**—only updating the issuer URI and client credentials in configuration.

---

## 4. Security Invariants
- **No Custom Human Password Database**: VoltGrid will not implement custom password collection, hashing, or human credential tables. All human credentials are treated as untrusted and delegated to the OIDC provider.
- **Fail Closed**: If the OIDC provider or JWKS discovery endpoint is unreachable and cached keys have expired, backend services fail closed by rejecting access tokens.
- **Strict Audience & Issuer Validation**: Backend services validate that `iss` matches the configured issuer and `aud` contains `voltgrid-api`.
