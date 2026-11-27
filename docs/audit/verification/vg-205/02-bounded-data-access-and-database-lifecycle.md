# VG-205 Bounded Data Access, Integrity, and Database Lifecycle

On 2026-11-27, the bounded data access, query safety limits, transaction sequence completeness bounds, and database lifecycle retention controls specified in issue [#7](https://github.com/Suthankan1/voltgrid/issues/7) and [ADR 0013](../../adr/0013-bounded-data-access-and-database-lifecycle.md) were implemented and verified.

## Architectural Mechanisms Delivered

| Finding / Area | Mechanism | Failure Mode Prevented |
| --- | --- | --- |
| **BUG-005** (Unbounded GraphQL Queries) | Bounded pagination on `stations`, `transactions`, `stationTransactions`, and `transactionMeterSamples` with `MAX_PAGE_SIZE = 100` and `MAX_UNPAGINATED_LIMIT = 500`. | Prevents JVM memory exhaustion, heap saturation, and DB connection pooling collapse on large fleets. |
| **BUG-005** (GraphQL Depth Limit) | `MaxQueryDepthInstrumentation(15)` registered in Station and Operations services. | Eliminates GraphQL query recursion attacks and denial-of-service. |
| **BUG-001 & DATA-002** (Integrity View Explosion & Blind Spot) | Rewrote `transaction_integrity_status` view (Flyway `V20`) to use indexed count and boundary checks instead of `generate_series`. | Eliminates series memory explosion and the blind spot where sequences jumping beyond 10,000 were falsely marked `COMPLETE`. |
| **BUG-001** (Completeness Sequence Overflow) | `TransactionCompletenessService` strictly evaluates $C_{receipts} < K \implies \text{INCOMPLETE}$, bounding missing list to 10,000 items. | Guarantees that ended transactions with missing receipts are strictly reported as `INCOMPLETE`, never `COMPLETE`. |
| **DATA-001** (Column Width Harmonization) | Flyway `V7` in Operations Service widens `station_status_projections.station_id` to `VARCHAR(255)`. | Eliminates cross-service projection write failures for station identifiers longer than 128 characters. |
| **DATA-003** (Lifecycle Data Retention) | `StationDataRetentionService` and `OperationsDataRetentionService` purge published outbox events and processed event receipts older than cutoff. | Bounds monotonic table growth and maintains index health over time. |

## Database Migrations

- **Station Service (`V20__optimize_transaction_integrity_view.sql`)**:
  - Replaces `generate_series` with indexed count and boundary invariants.
- **Operations Service (`V7__widen_station_id_to_255.sql`)**:
  - `ALTER TABLE station_status_projections ALTER COLUMN station_id TYPE VARCHAR(255);`

## Verification Matrix

### 1. Bounded GraphQL Pagination (`GraphQlBoundedDataAccessIntegrationTests`)
- Validated page 0, page 1, page 2 (partial), and out-of-bounds page retrieval.
- Validated `MAX_UNPAGINATED_LIMIT = 500` ceiling when pagination arguments are omitted.
- Result: **PASSED**.

### 2. Transaction Sequence Completeness & Integrity (`TransactionCompletenessServiceTests` & `TransactionIntegrityViewIntegrationTests`)
- Massive sequence jump (last sequence = 25,000 with gap from 3..24,999): `transaction_integrity_status` view correctly returns `INCOMPLETE` (previously failed with `COMPLETE` in V14).
- Safe sequence range limit (> 100,000): `TransactionCompletenessService` correctly returns `INCOMPLETE` with bounded missing sequence list of 10,000 items (previously returned `COMPLETE`).
- Result: **PASSED**.

### 3. Data Retention Lifecycle Purge (`StationDataRetentionIntegrationTests` & `OperationsDataRetentionIntegrationTests`)
- Purges published outbox events older than 30 days while strictly retaining unpublished and recent published records.
- Purges processed event receipts older than 90 days.
- Result: **PASSED**.

### 4. Historical Migration Snapshot Regression
- `HistoricalStationMigrationTests` validates clean Flyway migration to version V20.
- `HistoricalProjectionMigrationTests` validates clean Flyway migration to version V7.
- Result: **PASSED**.
