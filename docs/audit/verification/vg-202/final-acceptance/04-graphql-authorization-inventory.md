# Current GraphQL authorization inventory

The resolver names match their schema fields. This is a source inventory of the secure-mode request path. The listed tests provide focused coverage. The signed-token, two-organization HTTP matrix remains open for every field.

| Service and resolver | Field | Required permission | Scope, query and denial behavior |
| --- | --- | --- | --- |
| Station `StationGraphQlController` | `stations` | `STATION_READ` | Station query by authorized organization. Organization denial raises an error. |
| Station `StationGraphQlController` | `station` | `STATION_READ` | Station query by ID and organization. Missing or foreign station returns null in an authorized organization context. |
| Station `StationGraphQlController` | `stationConnectors` | `STATION_READ` | Verify scoped station before connector query by station ID. Missing or foreign station returns an empty list. |
| Station `StationTransactionGraphQlController` | `transactions` | `SESSION_READ` | Transaction query by organization via station ownership. Organization denial raises an error. |
| Station `StationTransactionGraphQlController` | `networkTransactions` | `SESSION_READ`, `INTEGRITY_READ` | Network query by organization via station ownership. Permission denial raises an error. |
| Station `StationTransactionGraphQlController` | `networkTransactionPage` | `SESSION_READ`, `INTEGRITY_READ` | Organization passed to the filtered page query. A supplied station filter must match a station in that organization, or the query raises an error. |
| Station `StationTransactionGraphQlController` | `stationTransactions` | `SESSION_READ` | Transaction query by station and organization. Missing or foreign station returns an empty list. |
| Station `StationTransactionGraphQlController` | `transaction` | `SESSION_READ` | Scoped station lookup and transaction lookup by station, transaction and organization. Station denial raises an error. Missing transaction returns null. |
| Station `StationTransactionGraphQlController` | `transactionMeterSamples` | `METER_READ` | Scoped station lookup and meter query by station, transaction and organization. Station denial raises an error. |
| Station `StationTransactionGraphQlController` | `transactionCompleteness` | `INTEGRITY_READ` | Scoped station lookup precedes completeness calculation by station and transaction. Station denial raises an error. |
| Station `StationGraphQlController` | `organizations` | Authenticated subject | Active organizations for active memberships by subject. A provider-authorized platform administrator receives the organization list. |
| Station `StationGraphQlController` | `organization` | `ORG_READ` | Permission evaluated for the requested organization before lookup by ID. Access denial raises an error. |
| Station `StationGraphQlController` | `sites` | `SITE_READ` | Site repository query by authorized organization. Access denial raises an error. |
| Station `StationGraphQlController` | `organizationMembers` | `MEMBER_READ` | Membership repository query by authorized organization. Access denial raises an error. |
| Station `StationGraphQlController` | `administrativeAuditEvents` | `AUDIT_READ` | Audit service pages by authorized organization. Access denial raises an error. |
| Station `StationGraphQlController` | `registerStation` | `STATION_REGISTER` | Registration uses the resolved organization. A supplied site must be active and belong to that organization. Access denial raises an error. |
| Station `StationGraphQlController` | `createOrganization` | `PLATFORM_ADMIN` | Platform role from the validated identity. The organization repository inserts the record. Access denial raises an error. |
| Station `StationGraphQlController` | `createSite` | `SITE_MANAGE` | Site repository inserts against the authorized organization. Access denial raises an error. |
| Station `StationGraphQlController` | `inviteMember` | `MEMBER_MANAGE` | Organization lock and permission check precede membership insert. Invalid roles and access denial raise an error. |
| Station `StationGraphQlController` | `updateMemberRole` | `MEMBER_MANAGE` | Organization lock and permission check precede lookup by organization and user. The final active owner cannot be downgraded. Denial raises an error. |
| Station `StationGraphQlController` | `revokeMember` | `MEMBER_MANAGE` | Organization lock and permission check precede lookup by organization and user. The final active owner cannot be revoked. Missing membership returns false. |
| Station `StationGraphQlController` | `provisionStationCredential` | `CREDENTIAL_PROVISION` | Resolve the station and check permission on its stored organization before calling the credential service. Denial raises an error. |
| Station `StationGraphQlController` | `rotateStationCredential` | `CREDENTIAL_ROTATE` | Resolve the station and check permission on its stored organization before calling the credential service. Denial raises an error. |
| Station `StationGraphQlController` | `revokeStationCredential` | `CREDENTIAL_REVOKE` | Resolve the station and check permission on its stored organization before calling the credential service. Denial raises an error. |
| Operations `StationStatusGraphQlController` | `stationStatus` | `STATION_READ` via Station authorization | Projection query by station and organization. A mismatch with the active organization raises an error. An absent scoped projection returns null. |
| Operations `StationStatusGraphQlController` | `stationStatuses` | `STATION_READ` via Station authorization | Projection repository scrolls by organization with optional status filtering. A mismatch with the active organization raises an error. |

`MultiTenantStationGraphQlTests` exercises scoped station reads, registration with a site, credential provisioning and audit listing using test doubles. `MembershipOwnerProtectionTests` exercises role changes and revocation through the Spring transaction and actual PostgreSQL repositories using an injected identity. The existing transaction and Operations resolver tests cover query and pagination behavior. These tests leave site-level access policy, live revocation propagation, cross-tenant replay, and the positive and negative secure-mode checks for individual fields open.
