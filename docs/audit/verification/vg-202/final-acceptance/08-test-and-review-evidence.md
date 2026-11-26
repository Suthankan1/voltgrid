# Local verification and review

Baseline `a5c628f847f6976716ca272101ec0db026132268`, the merge of PR #67. PR #66 merged at `e4b621d97d57d416bc33df0ff96534882d964b24`. The migration SQL under Station's Flyway migration directory has no diff from the baseline. Flyway validation also passed on the historical upgrade cases and the fresh database.

The test host ran Java 25.0.4.1, Maven 3.9.16, Docker 29.9.3, PostgreSQL 18.6, Node 24.22.3 and pnpm 12.4.2.

| Working directory | Command | Result |
| --- | --- | --- |
| `services/station-service` | `./mvnw -q -Dtest=HistoricalStationMigrationTests test` | 10 passed, 0 failures, 0 errors, 0 skipped, 5.068 seconds in Surefire. PostgreSQL administrator executed maintenance, and Flyway ran as a non-superuser schema owner. |
| `services/station-service` | `VOLTGRID_SECURITY_REQUIRE_AUTH=false VOLTGRID_OCPP_AUTH_REQUIRED=false AUTHORIZATION_GRPC_TLS_ENABLED=false ./mvnw -q verify` | 204 passed, 0 failures, 0 errors, 0 skipped. This complete run used the existing compatibility environment before the test split maintenance and migration roles. The targeted run above covers the final regression code. |
| `services/authorization-service` | `./mvnw -q verify` | 30 passed, 0 failures, 0 errors, 0 skipped. |
| `services/operations-service` | `VOLTGRID_SECURITY_REQUIRE_AUTH=false ./mvnw -q verify` | 33 passed, 0 failures, 0 errors, 0 skipped before adding the historical projection regression. |
| `services/operations-service` | `./mvnw -q -Dtest=HistoricalProjectionMigrationTests test` | 1 passed, 0 failures, 0 errors, 0 skipped, 2.517 seconds in Surefire. |
| `integration-tests/authorization-flow` | `mvn -q verify` | 4 passed, 0 failures, 0 errors, 0 skipped. The harness reported a missing SLF4J binding and used a no-op logger. |
| `apps/operator-web` | `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit` | Installation, lint, type checking and `pnpm build` passed. 172 unit tests passed with 0 failures and 0 skipped. |
| `apps/operator-web` | `pnpm audit` | Registry audit reported no known vulnerabilities. Java dependency, static application and configuration scans still require evidence. |

The existing Station and Operations GitHub workflows discover the migration tests through Maven. The migration and audit tests call Flyway and PostgreSQL directly. Their assertions do not depend on the application's legacy HTTP and OCPP overrides.

An independent agent reviewed the migration SQL, tests and runbook. It identified the need to test a non-superuser migration role and give exact Flyway commands and reserved maintenance object names. The final targeted run exercises the separate migration role. Review scope was limited to this migration change. Full independent security acceptance remains open.
