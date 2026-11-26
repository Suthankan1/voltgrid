# VG-202: 03 - Tenancy & Data Isolation

## 1. Multi-Tenant Domain Model

In compliance with ADR-0003 and Issue [#13](https://github.com/Suthankan1/voltgrid/issues/13):
- **Organization (`organizations`)**: The root commercial security and billing boundary. Represents a Charge Point Operator (CPO), utility (CEB), or commercial fleet host.
- **Site (`sites`)**: Geographic physical location belonging to an organization, hosting charging hardware and grid connections.
- **Organization Membership (`organization_memberships`)**: Binding between an authenticated human identity (`userId`, `userEmail`) and an organization, carrying a specific `role` (`ORG_OWNER`, `STATION_OPERATOR`, `BILLING_ANALYST`, `READ_ONLY`).
- **Charging Station (`charging_stations`)**: Bound to an `organization_id` (mandatory, with default `'org_voltgrid_default'` for 100% backward compatibility) and optional `site_id`.

## 2. Database Migrations

- `services/station-service/src/main/resources/db/migration/V15__create_multi_tenant_security_schema.sql`:
  - Created tables `organizations`, `sites`, `organization_memberships`, `station_credentials`, and `administrative_audit_events`.
  - Added `organization_id` and `site_id` columns with foreign keys to `charging_stations`.
  - Seeded default organization `'org_voltgrid_default'` and site `'site_voltgrid_colombo'`.
  - Added `DEFAULT 'org_voltgrid_default'` to preserve compatibility with existing raw SQL integration tests.
- `services/operations-service/src/main/resources/db/migration/V4__add_tenant_and_station_id_width.sql`:
  - Widened `station_id` to `VARCHAR(255)` in `station_status_projections` (reconciling DATA-001).
  - Added `organization_id` column to projections.

## 3. Cross-Tenant Negative Testing

Verified in `TenantAuthorizationServiceTests`:
- `shouldDenyAccessWhenUserIsNotMemberOfTargetOrganization`: Asserts that an authenticated operator belonging to `org_ceb` cannot read or modify stations belonging to `org_voltgrid_default`.
- `shouldDenyAccessWhenMemberHasInsufficientRole`: Asserts that `READ_ONLY` role cannot invoke `CREDENTIAL_PROVISION` or `MEMBER_MANAGE`.
- `shouldAllowPlatformAdminAcrossOrganizations`: Asserts that `PLATFORM_ADMIN` can administer resources across organizational boundaries.
