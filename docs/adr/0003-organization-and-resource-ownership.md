# 3. Organization and Resource Ownership

## Context
VoltGrid is moving to support commercial EV charging operations across multiple Charging Point Operators (CPOs), site hosts, and fleet managers. Previously, stations, connectors, and transactions existed in a single global namespace without organizational partitioning.

## Security Problem
In a multi-tenant platform, cross-tenant data leakage is a critical vulnerability. An operator belonging to Organization A must never view, modify, or control stations, sites, transactions, or credentials belonging to Organization B. Trusting client-supplied tenant identifiers without server-side validation leads to Insecure Direct Object Reference (IDOR) vulnerabilities.

## Alternatives Considered
1. **Database-per-tenant**:
   - *Pros*: Hard physical data isolation.
   - *Cons*: Extreme operational overhead, complex Flyway migrations across hundreds of tenant databases, poor resource utilization for smaller site hosts.
2. **Schema-per-tenant**:
   - *Pros*: Logical schema separation within one database.
   - *Cons*: Schema migration complexity, connection pool exhaustion, rigid querying across multi-site operators.
3. **Shared Database, Discriminator Column (`organization_id`) with Strict Server-side Scoping**:
   - *Pros*: Flexible, efficient resource utilization, standard relational foreign keys, supported by Flyway and JPA.
   - *Cons*: Requires rigorous query filtering, indexed foreign keys, and default-deny authorization checks at every resolver and repository boundary.

## Selected Approach
Adopt **Shared Database with Strict Discriminator Column (`organization_id`) and Site Hierarchy**:
- **Organization (`organizations`)**: Top-level tenant entity with immutable UUID `id`, `name`, `status` (`ACTIVE`, `SUSPENDED`), and timestamps.
- **Site (`sites`)**: Operational location belonging to an organization (`organization_id`, `id`, `name`, `status`).
- **Station (`charging_stations`)**: Bound to an organization and optionally a site (`organization_id`, `site_id`, `id` as station identifier).
- **Transactions & Connectors**: Derive tenant ownership transitively through their associated `station_id`.
- **Tenant Context**: Extracted from authenticated user membership and propagated via `TenantContext` in request thread-locals; repositories and GraphQL resolvers filter strictly by the authorized `organization_id`.
- **Historical Data**: Existing legacy stations are migrated to an explicitly designated default development organization (`org_voltgrid_default`) for backward compatibility, preventing unmapped orphaned resources.

## Rationale
- Provides robust logical multi-tenancy without database proliferation.
- Enables consistent indexing on `(organization_id, ...)` across all query paths.
- Enforces relational foreign key integrity within service boundaries.

## Trade-offs
- Every query, mutation, and background projection must explicitly enforce `organization_id` scoping to prevent cross-tenant leakage.

## Trust Boundaries
- Client cannot declare arbitrary tenant context; the backend verifies user membership in the requested `organization_id` before executing any query or mutation.

## Failure Behavior
- Requests with missing, invalid, or unauthorized `organization_id` are rejected with HTTP 403 Forbidden / GraphQL `ACCESS_DENIED`.
- Unmapped legacy resources are isolated and inaccessible without authorized administrative assignment.

## Migration Implications
- Flyway migrations add `organizations`, `sites`, `organization_memberships`, and add foreign key columns (`organization_id`, `site_id`) to `charging_stations`.
- Flyway migration V15 backfills existing stations with the default organization to preserve system operation.

## Operational Implications
- Organizations and sites can be provisioned via administrative GraphQL mutations and operator web settings.

## Testing Strategy
- Multi-tenant isolation tests verifying that Organization A cannot read or mutate Organization B resources.
- Direct IDOR tampering tests asserting rejection of foreign station and transaction IDs.

## Remaining Dependencies
- Full geospatial site planning belongs to CORE-02 (Issue #19).
