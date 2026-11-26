# 9. Secure Configuration Profiles

## Context
VoltGrid runs across multiple environments: local developer workstations, headless automated CI runners, isolated integration test containers, and production deployment environments.

## Security Problem
Developer convenience settings (such as anonymous GraphQL queries, disabled OCPP authentication, or default development HMAC keys) can accidentally leak into staging or production environments if configuration is not strictly partitioned into explicit profiles.

## Alternatives Considered
1. **Single Configuration with Dynamic Flags**:
   - *Pros*: One configuration file.
   - *Cons*: High probability of human error enabling insecure flags in production.
2. **Environment Variable Overrides Only**:
   - *Pros*: Follows 12-factor principles.
   - *Cons*: Can silently fall back to insecure defaults if an environment variable is omitted.
3. **Explicit Spring Profiles with Hard Fails Closed on Missing Production Secrets**:
   - *Pros*: Explicit profiles (`dev`, `test`, `prod`, `secure-test`). In `prod` or `secure-test`, default secrets, anonymous access, and plaintext bypasses are completely forbidden, throwing `IllegalStateException` on application startup if required configuration is absent.

## Selected Approach
Adopt **Explicit Configuration Profiles with Startup Validation**:
- **Profiles**:
  - `dev`: Local development profile with test fixtures, local OIDC mock discovery, local loopback bindings.
  - `test`: Automated slice and unit testing with mock security context.
  - `secure-test`: End-to-end security verification profile enforcing strict authentication, real JWT verification, and active credential checks.
  - `prod`: Production profile; strict default-deny, requires explicit secret injection, rejects default HMAC keys, mandates TLS and WSS.
- **Fail-Fast Validations**:
  - `TokenFingerprintService`: Fails startup if `AUTHORIZATION_TOKEN_HMAC_KEY` is default or shorter than 32 bytes in `prod`.
  - `OcppHandshakeInterceptor`: Enforces device credential authentication (`voltgrid.ocpp.auth-required=true`) by default.
  - `SecurityFilterChain`: Authenticates all GraphQL and REST endpoints by default; allows unauthenticated access only to explicit health checks (`/actuator/health`).

## Rationale
- Completely eliminates accidental deployment of insecure defaults.
- Enforces security invariants at compile and bootstrap time.

## Trade-offs
- Requires passing required environment variables when running in secure profiles.

## Trust Boundaries
- Environment variables supplied by orchestration infrastructure (Docker Compose / Kubernetes / ECS).

## Failure Behavior
- Application refuses to start if required security configuration or secrets are missing.

## Migration Implications
- `application.properties` updated to use fail-fast validation for production profiles while maintaining convenient local defaults in `dev`.

## Operational Implications
- Production deployments must inject required secrets via environment variables.

## Testing Strategy
- Tests asserting that missing HMAC key causes startup failure.
- Tests verifying that default security filter denies anonymous access.

## Remaining Dependencies
- Production secret injection via Terraform and AWS SSM / Secrets Manager (VG-203).
