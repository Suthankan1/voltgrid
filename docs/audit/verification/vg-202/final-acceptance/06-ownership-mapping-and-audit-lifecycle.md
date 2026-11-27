# VG-202R.6 Ownership mapping and audit lifecycle

On 2026-11-27, the R.6 slice was implemented and verified from main `1ad893642125015a2a7fbe24787bbd38ad18da48` on `remediation/vg-202r6-ownership-mapping-audit`.

## Implementation summary and verified invariants

### 1. Approved ownership mapping workflow
- Added `mapStation(input: MapStationInput!): ChargingStation!` to Station GraphQL.
- Quarantined stations (assigned `organization_id = NULL` under historical migration V18) can be mapped to an approved organization and site by authorized tenant operators.
- Enforces `Permission.STATION_REGISTER` on the destination organization.
- Validates site existence and ownership: mapping to a site belonging to a foreign organization or an inactive site is rejected with `TenantAccessDeniedException`.
- Prevents unauthorized cross-tenant re-assignment: if a station is already owned by a different organization, re-assignment requires `PLATFORM_ADMIN` privilege.
- Records structured `STATION_MAPPED` administrative audit events capturing previous and new organization assignments and site ID.

### 2. Administrative audit trail and metadata redaction
- Added `recordDeniedEvent(...)` in `AdministrativeAuditService` to record denied operations with structured failure reasons.
- Sanitizes metadata against an explicit allowlist (`stationId`, `userId`, `role`, `newRole`, `previousOrganizationId`, `siteId`, `action`, `reason`). Any unexpected, credential, or token attributes are redacted as `[REDACTED]`.
- Handles malformed metadata strings gracefully without throwing unhandled Jackson exceptions.
- Enforces bounded pagination: maximum page size is clamped to 100; negative page requests clamp to 0.

## Verification results

| Module | Command | Result |
| --- | --- | --- |
| `station-service` | `./mvnw test -Dtest=MultiTenantStationGraphQlTests,AdministrativeAuditServiceTests,StationGraphQlControllerTests` | 20 tests passed (9 multi-tenant GraphQL, 6 audit service, 5 controller), 0 failures, 0 errors, 0 skipped |

Related to issues #4, #13, #16.
