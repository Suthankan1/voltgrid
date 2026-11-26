# VG-202: 02 - Identity & Access Architecture

## 1. Human Operator Identity

In compliance with ADR-0001 and Issue [#12](https://github.com/Suthankan1/voltgrid/issues/12):
- VoltGrid relies on external OpenID Connect (OIDC) identity providers (Keycloak, AWS Cognito, Google Workspace, or mock identity during automated testing).
- Custom internal password databases for human users are prohibited; credentials and MFA authentication remain strictly external.
- Operator browsers establish an encrypted session cookie (`voltgrid_session`) containing user claims (`userId`, `email`, `roles`, `activeOrganizationId`) and access tokens.
- Development and local staging include five preset identity personas for verification without external cloud dependencies:
  1. `PLATFORM_ADMIN` (`admin@voltgrid.lk`)
  2. `ORG_OWNER` (`owner@voltgrid.lk`)
  3. `STATION_OPERATOR` (`operator@voltgrid.lk`)
  4. `BILLING_ANALYST` (`billing@voltgrid.lk`)
  5. `READ_ONLY` (`auditor@voltgrid.lk`)

## 2. Token Propagation & Security Context

- The Next.js frontend propagates the authenticated JWT in the `Authorization: Bearer <token>` HTTP header and tenant scope in `X-Tenant-Id: <orgId>` to backend APIs.
- In `station-service` and `operations-service`, `OperatorApiSecurityFilter` intercepts every incoming request:
  - Validates JWT signature, issuer, and expiration via `JwtTokenValidator`.
  - Sets thread-local `SecurityContext` containing `AuthenticatedUser`.
  - Clears `SecurityContext` in a `finally` block to prevent thread pool leakage.

## 3. Role-Based Access Control (RBAC) Matrix

In compliance with ADR-0004 and Issue [#14](https://github.com/Suthankan1/voltgrid/issues/14):

| Permission | PLATFORM_ADMIN | ORG_OWNER | STATION_OPERATOR | BILLING_ANALYST | READ_ONLY |
|---|:---:|:---:|:---:|:---:|:---:|
| `STATION_READ` | Yes | Yes | Yes | Yes | Yes |
| `STATION_REGISTER` | Yes | Yes | Yes | No | No |
| `CREDENTIAL_PROVISION` | Yes | Yes | No | No | No |
| `CREDENTIAL_ROTATE` | Yes | Yes | No | No | No |
| `CREDENTIAL_REVOKE` | Yes | Yes | No | No | No |
| `MEMBER_READ` | Yes | Yes | Yes | Yes | Yes |
| `MEMBER_MANAGE` | Yes | Yes | No | No | No |
| `AUDIT_READ` | Yes | Yes | No | Yes | Yes |
| `SITE_READ` | Yes | Yes | Yes | Yes | Yes |
| `SITE_MANAGE` | Yes | Yes | No | No | No |
| `ORG_READ` | Yes | Yes | No | No | No |
| `ORG_MANAGE` | Yes | No | No | No | No |

Enforced via `TenantAuthorizationService.assertAuthorized(organizationId, permission)`.
Cross-tenant access without appropriate role throws `TenantAccessDeniedException` and is sanitized by `StationGraphQlExceptionHandler`.
