# 10. Migration and Compatibility Strategy

## Context
VoltGrid has an existing production-like database with historical charging stations, connectors, transactions, and meter samples. Introducing multi-tenant organization models, device credentials, and versioned HMAC keys must preserve all existing data without data loss or downtime.

## Security Problem
Careless database migrations can lock tables, drop active foreign keys, orphan existing records, or render legacy charging stations unable to connect or transact.

## Alternatives Considered
1. **Wipe and Reinitialize Schema**:
   - *Pros*: Easiest implementation.
   - *Cons*: Destroys all historical data and violates zero-data-loss commercial requirements.
2. **Expand / Backfill / Contract Multi-Phase Migration**:
   - *Pros*: Safely introduces new columns as nullable, backfills historical data with trusted mappings, validates data integrity, and applies non-null constraints and indexes without breaking existing functionality.
   - *Cons*: Requires disciplined Flyway migration scripting.

## Selected Approach
Implement **Expand / Backfill / Contract Migration Strategy via Flyway**:
- **Phase 1: Expand**:
  - Create `organizations`, `sites`, `organization_memberships`, `station_credentials`, and `administrative_audit_events` tables.
  - Add nullable `organization_id` and `site_id` columns to `charging_stations`.
  - Add versioned HMAC key configuration support to `authorization-service`.
- **Phase 2: Backfill**:
  - Insert a designated default development organization (`org_voltgrid_default`, "VoltGrid Commercial Operations") and site (`site_voltgrid_colombo`, "Colombo Flagship Station").
  - Backfill existing stations with `organization_id = 'org_voltgrid_default'` and `site_id = 'site_voltgrid_colombo'`.
  - Seed initial device credentials for existing test stations so automated regression tests continue to operate cleanly.
  - Provide legacy key version mapping for existing token fingerprints (`v1 -> voltgrid-local-development-hmac-key-change-me`).
- **Phase 3: Validate**:
  - Add foreign key constraints and composite indexes.
  - Validate that zero stations have orphaned ownership.
- **Rollback Safety**:
  - All migrations are forward-only. Rollback scripts are documented for testing recovery, but production rollbacks rely on forward-compatible hotfixes without deleting commercial data.

## Rationale
- Guarantees 100% preservation of historical station and session records.
- Ensures all existing automated test suites (220 backend tests, 168 frontend tests) continue passing.
- Provides immediate multi-tenant isolation for newly registered stations.

## Trade-offs
- Requires forward-only migration scripts that carefully handle existing rows.

## Trust Boundaries
- Database migration executes during service startup under Flyway database user permissions.

## Failure Behavior
- If migration fails, Flyway stops startup and rolls back the migration transaction, leaving the database in a known good state.

## Migration Implications
- Forward-only migrations `V15__create_multi_tenant_security_schema.sql` (Station Service) and `V2__add_versioned_token_fingerprints.sql` (Authorization Service).

## Operational Implications
- Upgrades are applied automatically on container startup without manual SQL intervention.

## Testing Strategy
- Real PostgreSQL migration integration tests verifying upgrade from baseline to current schema.
- Verification that historical stations, transactions, and meter samples remain queryable.

## Remaining Dependencies
- None.
