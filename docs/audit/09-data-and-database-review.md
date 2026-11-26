# 09 — Data and Database Review

> **Audit**: VG-200 · **Commit**: `e6bf891` · **Date**: 2026-11-26

## Overview

VoltGrid employs independent PostgreSQL 16+ databases for each backend service:
- `voltgrid_station` (Port 5434)
- `voltgrid_auth` (Port 5433)
- `voltgrid_ops` (Port 5435)

Schema evolution is governed strictly by Flyway database migrations.

---

## 1. Migration Inventory & Sequence Analysis

### station-service migrations
| Migration | Description | Observations |
|---|---|---|
| `V1__create_charging_stations.sql` | `charging_stations` table (`id VARCHAR(255)`, `name`, `status`) | Primary key `id` length mismatch with outbox. |
| `V2__add_station_last_seen.sql` | Adds `last_seen_at TIMESTAMP WITH TIME ZONE` | Proper timezone handling. |
| `V3__create_station_connectors.sql` | `station_connectors` table with composite PK `(station_id, evse_id, connector_id)` | FK constraint on `charging_stations(id)`. |
| `V4__create_charging_transactions.sql` | `charging_transactions` table | Tracks `station_id`, `transaction_id`, status, started_at. |
| `V5__add_transaction_end_time.sql` | Adds `ended_at` and `last_sequence_number` | Defaults sequence number to 0. |
| `V6__create_transaction_meter_samples.sql` | `transaction_meter_samples` table | High-write table, missing composite index. |
| `V7__create_transaction_event_receipts.sql` | Idempotency receipts for OCPP message receipts | Index on `(station_id, transaction_id, sequence_number)`. |
| `V8` | **MISSING** | Migration sequence jumps directly from V7 to V9. |
| `V9__create_outbox_events.sql` | `outbox_events` table for transactional outbox | `aggregate_id VARCHAR(128)`. Status index. |
| `V10__add_outbox_trace_context.sql` | Adds `trace_id` and `span_id` columns | For W3C distributed trace propagation. |
| `V11__create_transaction_integrity_view.sql`| View `v_transaction_data_integrity` | SQL view calculating sequence gaps via `generate_series`. |

### authorization-service migrations
| Migration | Description | Observations |
|---|---|---|
| `V1__create_authorization_tokens.sql` | `authorization_tokens` (`id`, `token_fingerprint`, `status`, `expires_at`, `revoked_at`) | Index on `token_fingerprint` UNIQUE. |

### operations-service migrations
| Migration | Description | Observations |
|---|---|---|
| `V1__create_station_status_projections.sql` | `station_status_projections` | Read model projection for operator fleet dashboard. |
| `V2__create_processed_event_receipts.sql` | `processed_event_receipts` | Deduplication table for Kafka event consumption. |

---

## 2. Key Database Findings & Risks

### Finding 1: Schema Type Mismatch — Station ID Truncation Risk (DATA-001)
- In `V1__create_charging_stations.sql`:
  ```sql
  CREATE TABLE charging_stations (
      id VARCHAR(255) PRIMARY KEY, ...
  );
  ```
- In `V9__create_outbox_events.sql`:
  ```sql
  CREATE TABLE outbox_events (
      ...
      aggregate_id VARCHAR(128) NOT NULL, ...
  );
  ```
- **Risk**: A valid station ID between 129 and 255 characters will register successfully in `charging_stations`, but when `StationStatusOutboxWriter` attempts to save an outbox event with `aggregateId = station.id()`, PostgreSQL throws `value too long for type character varying(128)`, aborting the transaction.

### Finding 2: V11 Transaction Integrity View Performance Bottleneck (DATA-002)
- In `V11__create_transaction_integrity_view.sql`:
  ```sql
  CREATE OR REPLACE VIEW v_transaction_data_integrity AS ...
  CROSS JOIN LATERAL generate_series(0, ct.last_sequence_number) AS s(expected_seq)
  ...
  ```
- **Risk**: If a malicious or buggy station submits a `seqNo` of `2,000,000`, querying this view forces PostgreSQL to generate 2 million rows in-memory per transaction to calculate completeness. This causes severe disk spilling, CPU saturation, and query timeouts.

### Finding 3: Missing Composite Index on High-Frequency Meter Samples (DATA-003)
- `transaction_meter_samples` receives sampled readings for every meter event.
- Queries in `StationTransactionQueryService`:
  ```java
  meterSampleRepository.findByStationIdAndTransactionIdOrderBySequenceNumberAsc(stationId, transactionId);
  ```
- **Deficiency**: The table only has an index on `transaction_id`. As the table grows to millions of rows, querying meter samples for a transaction requires sequential filtering of `station_id` and sorting in memory.
- **Remediation**: Add `CREATE INDEX idx_meter_samples_lookup ON transaction_meter_samples(station_id, transaction_id, sequence_number ASC)`.

### Finding 4: Absence of Optimistic Locking across All Entities (DATA-004)
- None of the JPA entities across the three services declare `@Version`:
  - `ChargingStationEntity`
  - `StationConnectorEntity`
  - `ChargingTransactionEntity`
  - `AuthorizationTokenEntity`
  - `StationStatusProjectionEntity`
- **Impact**: Concurrent updates (e.g., simultaneous status notifications from multi-connector chargers, or simultaneous registration calls) are subject to lost updates (last-write-wins).

### Finding 5: Transaction Boundary Gaps (BUG-011)
- `StationRegistrationService.register(id, name)`:
  - Lacks `@Transactional`.
  - Read-then-write pattern: calls `stationReader.findById(id)` followed by `stationWriter.save(...)`.
  - Concurrent requests with identical IDs can both evaluate `isEmpty() == true`, causing unique constraint violation exceptions rather than clean domain conflict handling.

---

## 3. Data Retention & Purge Policy Gaps

Currently, no automated cleanup or archival mechanism exists for:
1. `outbox_events` (`status = 'PROCESSED'` records accumulate forever)
2. `transaction_meter_samples` (rapidly consumes table space)
3. `transaction_event_receipts` (permanent duplicate protection table)
4. `processed_event_receipts` (`operations-service` event log)

**Recommendation**: Add partition strategies or scheduled retention jobs in VG-205 to purge processed receipts older than 30–90 days.
