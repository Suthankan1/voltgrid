# 4. Role and Permission Model

## Context
Commercial EV charging platforms involve diverse human actors: platform administrators, organization owners, charging station operators, field technicians, customer support agents, and finance specialists. Access control must restrict privileges based on least-privilege principles.

## Security Problem
Using coarse-grained role checks (such as `hasRole("ADMIN")` or `hasRole("OPERATOR")`) across all organizations leads to privilege escalation and broken function-level authorization. A user granted operator rights in Organization A must not automatically possess privileges in Organization B, nor should an operator possess permissions to modify organization ownership or rotate device credentials.

## Alternatives Considered
1. **Global Roles (Application-wide roles in JWT claims)**:
   - *Pros*: Simple to evaluate from token claims.
   - *Cons*: Cannot express per-tenant responsibilities; leads to catastrophic cross-tenant privilege escalation.
2. **Coarse-grained Organization Roles (Admin / Member)**:
   - *Pros*: Straightforward.
   - *Cons*: Fails to separate operational, technical, financial, and administrative duties.
3. **Role-Based Access Control (RBAC) with Fine-Grained Permissions Scoped by Organization**:
   - *Pros*: Granular permissions (e.g., `station:register`, `credential:rotate`, `session:read`, `audit:read`) assigned to roles, evaluated strictly within the context of the user's active organization membership.
   - *Cons*: Requires an explicit permission evaluation service and role-permission matrix.

## Selected Approach
Implement **Organization-Scoped RBAC with Fine-Grained Permissions**:
- **Roles**:
  - `PLATFORM_ADMIN`: Cross-organization governance, platform diagnostics (reserved for platform operators).
  - `ORG_OWNER`: Full administrative governance of the organization, membership management, site and station lifecycle.
  - `ORG_ADMIN`: Operational management, station registration, site management, credential administration.
  - `OPERATOR`: Station monitoring, connector status oversight, session inspection.
  - `TECHNICIAN`: Hardware diagnostics, connector testing, technical maintenance.
  - `SUPPORT`: Customer assistance, session lookup, transaction receipt verification.
  - `FINANCE`: Transaction volume reporting, meter data analysis.
- **Permissions**:
  - `org:read`, `org:manage`, `member:read`, `member:manage`
  - `site:read`, `site:manage`
  - `station:read`, `station:register`, `station:manage`
  - `credential:provision`, `credential:rotate`, `credential:revoke`
  - `session:read`, `meter:read`, `integrity:read`
  - `audit:read`
- **Default Deny**: All operations default to denied unless an active membership in the target organization contains a role granting the required permission.

## Rationale
- Strictly adheres to the principle of least privilege.
- Prevents horizontal and vertical privilege escalation.
- Decouples business logic from role names by checking capabilities (`hasPermission("station:register")`).

## Trade-offs
- Requires database lookup or claims caching of user membership and roles per request.

## Trust Boundaries
- Membership and roles are stored in the database (`organization_memberships`) and validated against the verified user subject from the OIDC token.

## Failure Behavior
- If user has no active membership in the target organization, access is denied (403 Forbidden).
- If role does not possess the requisite permission, access is denied (403 Forbidden).

## Migration Implications
- Initial system bootstrap provisions a platform admin and default organization owner membership.

## Operational Implications
- Organization owners can invite and manage members through the operator web administration interface.

## Testing Strategy
- Positive and negative matrix tests verifying every permission against every role.
- Horizontal privilege escalation tests asserting that an operator in Org A cannot execute actions in Org B.
- Vertical privilege escalation tests asserting that an operator cannot assign roles or rotate credentials.

## Remaining Dependencies
- Integration with external IdP groups for automated role sync (deferred to VG-203/206).
