# Local verification and review

Baseline `a5c628f847f6976716ca272101ec0db026132268`, the merge of PR #67. PR #66 merged at `e4b621d97d57d416bc33df0ff96534882d964b24`. The migration SQL under Station's Flyway migration directory has no diff from the baseline. Flyway validation also passed on the historical upgrade cases and the fresh database.

The test host ran Java 25.0.4.1, Maven 3.9.16, Docker 29.9.3, PostgreSQL 18.6, Node 24.22.3 and pnpm 12.4.2.

| Working directory | Command | Result |
| --- | --- | --- |
| `services/station-service` | `./mvnw -q -Dtest=HistoricalStationMigrationTests test` | 10 passed, 0 failures, 0 errors, 0 skipped, 5.068 seconds in Surefire. PostgreSQL administrator executed maintenance, and Flyway ran as a non-superuser schema owner. |
| `services/station-service` | `VOLTGRID_SECURITY_REQUIRE_AUTH=false VOLTGRID_OCPP_AUTH_REQUIRED=false AUTHORIZATION_GRPC_TLS_ENABLED=false ./mvnw -q verify` | 207 passed, 0 failures, 0 errors, 0 skipped, 36.230 seconds summed across Surefire test classes. This run used the existing compatibility environment and included the final owner protection and migration role changes. |
| `services/station-service` | `VOLTGRID_SECURITY_REQUIRE_AUTH=false VOLTGRID_OCPP_AUTH_REQUIRED=false AUTHORIZATION_GRPC_TLS_ENABLED=false ./mvnw -q -Dtest=MembershipOwnerProtectionTests test` | 3 passed, 0 failures, 0 errors, 0 skipped, 8.597 seconds in Surefire. Includes a PostgreSQL-observed lock wait and the result after the first transaction commits. Tests inject identity and exercise the proxied resolver, transaction, repositories and audit writes. |
| `services/authorization-service` | `./mvnw -q verify` | 30 passed, 0 failures, 0 errors, 0 skipped, 7.027 seconds summed across Surefire test classes. |
| `services/operations-service` | `VOLTGRID_SECURITY_REQUIRE_AUTH=false ./mvnw -q verify` | 34 passed, 0 failures, 0 errors, 0 skipped, 61.513 seconds summed across Surefire test classes. |
| `services/operations-service` | `./mvnw -q -Dtest=HistoricalProjectionMigrationTests test` | 1 passed, 0 failures, 0 errors, 0 skipped, 2.517 seconds in Surefire. |
| `integration-tests/authorization-flow` | `mvn -q verify` | 4 passed, 0 failures, 0 errors, 0 skipped, 38.102 seconds summed across Surefire test classes. The harness reported a missing SLF4J binding and used a no-op logger. |
| `apps/operator-web` | `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit` | Installation, lint, type checking and `pnpm build` passed. 172 unit tests passed with 0 failures and 0 skipped. |
| `apps/operator-web` | `pnpm test:e2e`, `pnpm test:a11y` | 36 Chromium tests passed in 1.9 minutes. The separate WCAG run passed in 16.9 seconds. Both used isolated Keycloak and fixture GraphQL. |
| `apps/operator-web` | `pnpm test:e2e:cross-browser` | 18 Chromium and 18 WebKit tests passed. The 18 Firefox cases failed with the known local launch limitation. |
| `apps/operator-web` | `pnpm audit` | Registry audit reported no known vulnerabilities. Java dependency, static application and configuration scans still require evidence. |

The existing Station and Operations GitHub workflows discover the migration tests through Maven. The migration and audit tests call Flyway and PostgreSQL directly. Their assertions do not depend on the application's legacy HTTP and OCPP overrides.

An independent agent reviewed the migration SQL, tests and runbook. It identified the need to test a non-superuser migration role and give exact Flyway commands and reserved maintenance object names. The final targeted run exercises the separate migration role. Review scope was limited to this migration change. Full independent security acceptance remains open.

The reviewer also checked the owner-removal lock and identified its dependence on PostgreSQL READ COMMITTED semantics. The membership mutations explicitly select that isolation level.
