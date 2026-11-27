# 13. Bounded Data Access, GraphQL Pagination, and Database Lifecycle

Date: 2026-11-27

## Status

Accepted

## Context

The VoltGrid core architecture review ([VG-200](../../audit/03-architecture-review.md) and [Audit Findings](../../audit/findings.csv)) identified several vulnerabilities related to data access, unbounded queries, database resource exhaustion, and lifecycle management:

1. **BUG-005 (Unbounded GraphQL Queries & Memory Exhaustion)**: Several GraphQL queries (`stations`, `transactions`, `stationTransactions`, `transactionMeterSamples`) returned unpaginated list structures. In fleets with tens of thousands of chargers and millions of meter samples, unconstrained list queries risk JVM `OutOfMemoryError` and saturated database connections. Additionally, recursive or deep nested queries could induce denial-of-service without max query depth limits.
2. **BUG-001 & DATA-002 (Transaction Integrity Series Explosion & Blind Spot)**:
   - The `transaction_integrity_status` PostgreSQL view used `generate_series(first, LEAST(last, first + 10000))` to detect sequence gaps. If an EVSE emitted sparse sequences or jumped beyond 10,000, `generate_series` silently evaluated only the first 10,000 numbers. If no gaps occurred in the first 10,000, it defaulted to `COMPLETE` despite thousands of missing subsequent receipts.
   - In Java, `TransactionCompletenessService` capped enumeration at 100,000 but returned an empty missing list when range exceeded 100,000, causing `determineStatus` to mistakenly report `COMPLETE`.
3. **DATA-001 (Cross-Service Identifier Width Mismatch)**: While `outbox_events.aggregate_id` and `charging_stations.id` were standardized to `VARCHAR(255)`, `station_status_projections.station_id` in Operations Service remained `VARCHAR(128)`, creating projection persistence failures for long station identifiers.
4. **DATA-003 & Data Lifecycle Purge**: High-volume tables (`outbox_events` and `processed_event_receipts`) grow monotonically without automated retention policies, degrading index maintenance and query performance over time.

## Decision

### 1. Bounded GraphQL Pagination and Depth Limits
- **Backwards-Compatible Bounded Pagination**: All fleet and transaction list queries accept optional `(page: Int, size: Int)` arguments.
- **Safety Ceilings**:
  - `MAX_PAGE_SIZE = 100` enforced for all paginated queries.
  - `MAX_UNPAGINATED_LIMIT = 500` enforced when client omits pagination parameters.
- **Max Query Depth Guard**: Enforce a maximum GraphQL query execution depth of 15 using `MaxQueryDepthInstrumentation` to prevent recursive DOS attacks.

### 2. O(1) Transaction Integrity Determination
- **Mathematical Exactness**: A sequence of contiguous integers starting at $S_{first}$ and ending at $S_{last}$ contains exactly $K = S_{last} - S_{first} + 1$ elements.
- If the distinct count of recorded receipts $C_{receipts} < K$, the transaction is mathematically guaranteed to be incomplete.
- `transaction_integrity_status` view and `TransactionCompletenessService` evaluate count and bounds directly:
  - If $C_{receipts} < K \implies \text{INCOMPLETE}$.
  - If $C_{receipts} == K$ and $S_{max} == S_{last} \implies \text{COMPLETE}$.
  - When range $> 100,000$, enumeration of missing elements is truncated, but the status is strictly evaluated as `INCOMPLETE` (never `COMPLETE`).

### 3. Schema Harmonization
- In Operations Service, apply Flyway migration `V7__widen_station_id_to_255.sql`:
  ```sql
  ALTER TABLE station_status_projections
      ALTER COLUMN station_id TYPE VARCHAR(255);
  ```

### 4. Data Lifecycle Retention Policies
- **Station Service**: Provide `StationDataRetentionService.purgePublishedOutboxEvents(Instant cutoff)` to safely prune published outbox events older than the retention window (default 30 days).
- **Operations Service**: Provide `OperationsDataRetentionService.purgeProcessedEventReceipts(Instant cutoff)` to prune processed consumer receipts older than the retention window (default 90 days).
- Purge queries execute in bounded batches to prevent long-running table locks.

## Consequences

### Positive
- Completely prevents memory saturation and DOS from unbounded GraphQL queries.
- Fixes the false-complete bug for sparse/jumped transaction sequences without generating unbounded series.
- Harmonizes identifier column widths across Station and Operations services.
- Controls database growth through deterministic retention routines.

### Negative
- Clients requesting more than 500 items in a single unpaginated query must adopt pagination arguments.
