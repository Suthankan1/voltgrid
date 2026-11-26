# 06 — Database and Concurrency Verification Results

> **Milestone**: VG-201
> **Databases**: PostgreSQL 18.6 (station, authorization, operations) · Flyway Schema Migrations
> **Execution Date**: 2026-11-26

---

## 1. Flyway Migration Inventory and Schema Sequence

All database migrations were verified across the three independent services.

### Station Service Migrations
| Version | Description | Audit Findings Reconciled |
|---|---|---|
| `V1` | `create_charging_stations.sql` (`id VARCHAR(255)`) | Initial schema baseline |
| `V2` | `add_station_last_seen.sql` (`last_seen_at TIMESTAMPTZ`) | Timezone-aware liveness column |
| `V3` | `create_station_connectors.sql` | Composite primary key `(station_id, evse_id, connector_id)` |
| `V4` | `create_charging_transactions.sql` | Transaction lifecycle tracking |
| `V5` | `add_transaction_end_time.sql` | Adds `ended_at`, `last_sequence_number` |
| `V6` | `create_transaction_meter_samples.sql` | High-write sampled values |
| `V7` | `create_transaction_event_receipts.sql` | Idempotency receipts with unique constraint |
| *(V8)* | *Missing sequence number in Flyway baseline* | Documented as harmless historical jump in INF-002 |
| `V9` | `create_outbox_events.sql` | Transactional outbox table (`aggregate_id VARCHAR(128)`) |
| `V10`| `add_outbox_trace_context.sql` | Distributed tracing columns (`trace_id`, `span_id`) |
| `V11`| `create_transaction_integrity_view.sql` | View `transaction_integrity_status` using `generate_series` |
| `V12`| `widen_outbox_aggregate_id.sql` | Widens `outbox_events.aggregate_id` to `VARCHAR(255)` (**DATA-001**) |
| `V13`| `add_meter_samples_composite_index.sql` | Creates composite index on `transaction_meter_samples` (**DATA-003**) |
| `V14`| `add_outbox_retry_and_view_protection.sql` | Caps view `generate_series` at 10,000; adds outbox retry columns |

### Operations Service Migrations
| Version | Description |
|---|---|
| `V1` | `create_station_status_projection.sql` (`station_id VARCHAR(128) PRIMARY KEY`) |
| `V2` | `create_processed_event_receipts.sql` (Kafka consumer idempotency) |
| `V3` | `index_station_status_projection_filter.sql` (Operational status filtering index) |

### Authorization Service Migrations
| Version | Description |
|---|---|
| `V1` | `create_authorization_tokens.sql` (Token fingerprints and statuses) |

---

## 2. Column Width Consistency Verification (DATA-001)

### The Issue
Historically, `charging_stations.id` was defined as `VARCHAR(255)`, while `outbox_events.aggregate_id` was defined as `VARCHAR(128)`. When a station with an ID between 129 and 255 characters was registered, station persistence succeeded, but outbox event emission failed with:
`ERROR: value too long for type character varying(128)`

### Verification Findings
1. **Station Service Fix Verified**:
   - Migration `V12__widen_outbox_aggregate_id.sql` executed `ALTER TABLE outbox_events ALTER COLUMN aggregate_id TYPE VARCHAR(255);`.
   - Verified that stations with 255-character identifiers (tested via `StationRegistrationServiceTests.shouldRegisterStationWithMaximumLengthIdentifier`) successfully persist to `charging_stations` and write to `outbox_events`.
2. **Cross-Service Discrepancy Identified**:
   - In `operations-service`, `V1__create_station_status_projection.sql` defines:
     ```sql
     CREATE TABLE station_status_projections (
         station_id VARCHAR(128) PRIMARY KEY, ...
     );
     ```
   - In `StationStatusProjectionEntity.java`:
     ```java
     @Id
     @Column(name = "station_id", nullable = false, length = 128)
     private String stationId;
     ```
   - **Impact**: If a station with an identifier longer than 128 characters is registered, it succeeds in `station-service`, but when `ProjectingStationStatusChangedHandler` processes the Kafka event, inserting into `station_status_projections` will throw `value too long for type character varying(128)`.
   - **Reconciliation**: This cross-service schema synchronization is formally tracked under **VG-205 (Issue #7)** for resolution via a new Flyway migration in operations-service.

---

## 3. Composite Index Verification (DATA-003)

### The Query
In `StationTransactionQueryService.java`:
```java
meterSampleRepository.findByStationIdAndTransactionIdOrderBySequenceNumberAsc(
    stationId,
    transactionId
);
```

### The Index
Migration `V13__add_meter_samples_composite_index.sql` created:
```sql
CREATE INDEX IF NOT EXISTS idx_meter_samples_station_tx_seq
    ON transaction_meter_samples (station_id, transaction_id, sequence_number ASC);
```

### Verification
- **Index Column Alignment**: The leading columns `(station_id, transaction_id)` satisfy the equality predicates, and the trailing `sequence_number ASC` satisfies the ordering clause without requiring a temporary in-memory sort.
- **Query Plan**: Index scan directly returns sorted tuples.
- **Future Considerations**: Pagination (`LIMIT` / cursor) and table partitioning for high-frequency sampled data remain tracked under **VG-205 (Issue #7)**.

---

## 4. Concurrency and Race Condition Verification

### A. WebSocket Connection Ownership (BUG-003)
- **Mechanism**: `OcppWebSocketHandler` tracks `ConcurrentHashMap<String, String> activeStationSessions`.
- **Verified Behavior**: Reconnect loop (Session 1 -> Session 2 -> Session 1 close) ignores close callback for Session 1 because `session1.getId()` does not match `activeStationSessions.get(stationId)`.
- **Limitation**: In-memory registry is process-local. Distributed cross-instance connection fencing across scaled backend replicas is tracked under **VG-204 (Issue #6)**.

### B. Equal-Timestamp Projection Updates (BUG-010)
- **Mechanism**: `StationStatusProjectionEntity.apply` uses `if (statusChangedAt.isBefore(this.statusChangedAt)) return false;`.
- **Verified Behavior**: Events in the same millisecond are applied.
- **Limitation**: Demonstrated via `shouldDemonstrateEqualTimestampArrivalOrderSensitivity` that two events occurring in the exact same millisecond result in last-write-wins dependent on Kafka delivery order. Causal determinism requires aggregate versioning, tracked under **VG-204 (Issue #6)**.

### C. Monotonic Connector Status Updates (BUG-008 & DATA-004)
- **Mechanism**: `StationConnectorStatusService.updateStatus` compares timestamps against existing DB record.
- **Verified Behavior**: Stale updates are dropped.
- **Limitation**: Read-modify-write without `@Version` optimistic locking (DATA-004) leaves concurrent DB writes from parallel threads vulnerable to lost updates. Tracked under **VG-205 (Issue #7)**.

### D. Station Registration Transaction Boundaries (BUG-011)
- **Mechanism**: `@Transactional` annotation on `StationRegistrationService.register`.
- **Verified Behavior**: Database write failures roll back cleanly. Simultaneous duplicate registrations with identical IDs are serialized or rejected by PostgreSQL primary key constraint.
