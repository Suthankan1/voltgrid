# VG-204 Distributed Reliability, Ordering, and Multi-Instance Fencing

On 2026-11-27, the distributed reliability, causal ordering, and multi-instance connection fencing controls specified in issue [#6](https://github.com/Suthankan1/voltgrid/issues/6) and [ADR 0012](../../adr/0012-distributed-reliability-ordering-and-fencing.md) were implemented and verified.

## Architectural Mechanisms Delivered

| Mechanism | Description | Failure Mode Prevented |
| --- | --- | --- |
| **Aggregate Partition Key** | Outbox events are partitioned on Kafka by aggregate ID (`stationId`). | Prevents out-of-order delivery across different Kafka partitions for the same charger. |
| **Causal Sequence Ordering** | Monotonic `status_sequence_number` per station aggregate attached to `StationStatusChangedEvent`. | Reordered events or network replays with older sequence numbers are discarded by `StationStatusProjectionEntity`. |
| **Unversioned Legacy Fallback** | Uses timestamps while a projection has only legacy events. The first positive sequence establishes authority regardless of the legacy timestamp. | Subsequent legacy deliveries retain their deduplication receipts and leave the sequenced projection intact. |
| **Multi-Instance Generation Fencing** | Monotonic `connection_generation` stored on `charging_stations` and attached to active WebSocket sessions. | Prevents split-brain: stale disconnects on an old node do not mark a station offline after it reconnects to another node. |
| **Stale Socket Termination** | Frames received on a session with a superseded generation are terminated with `CloseStatus.POLICY_VIOLATION`. | Prevents stale instances from accepting or processing outdated commands. |
| **Outbox Exponential Backoff** | `findNextUnpublishedForUpdate` enforces exponential backoff: `last_attempted_at + (power(2, retry_count - 1) * interval '500 millisecond') <= NOW()`. | Prevents spin-locking and relay resource exhaustion during transient broker or database outages. |
| **Poison Event Quarantine & Safe Replay** | Outbox events reaching 5 retries are quarantined from active polling; `requeueQuarantinedEvents()` allows controlled operator replay. | Poison events do not block subsequent healthy outbox events; committed rows are never silently discarded. |
| **Durable Receipts & Atomic Projection** | `processed_event_receipts` table records event IDs atomically with projection updates within the same transaction. | Prevents duplicate processing; projection persistence failures roll back receipts to preserve at-least-once delivery. |

## Database Migrations

- **Station Service (`V19__add_station_connection_fencing_and_sequence.sql`)**:
  ```sql
  ALTER TABLE charging_stations
      ADD COLUMN IF NOT EXISTS connection_generation BIGINT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS status_sequence_number BIGINT NOT NULL DEFAULT 0;
  ```
- **Operations Service (`V6__add_sequence_number_to_station_status_projection.sql`)**:
  ```sql
  ALTER TABLE station_status_projections
      ADD COLUMN IF NOT EXISTS sequence_number BIGINT NOT NULL DEFAULT 0;
  ```

## Verification Matrices

### 1. Multi-Instance Station Connection Fencing (`MultiInstanceStationFencingIntegrationTests`)
- **Stale Disconnect Fencing**:
  - Station connects to Instance 1 -> generation 1 allocated, status ONLINE.
  - Station reconnects to Instance 2 -> generation 2 allocated, status ONLINE.
  - Delayed socket cleanup on Instance 1 triggers `afterConnectionClosed` for generation 1 -> Station Service recognizes generation 1 < 2, logs stale disconnect warning, and discards without marking offline. Station remains ONLINE.
  - Instance 2 tears down active generation 2 -> station cleanly transitions to OFFLINE with bumped status sequence.
  - Result: **PASSED**.
- **Stale Message Rejection**:
  - Frame sent on superseded socket on Instance 1 is rejected and socket terminated with `CloseStatus.POLICY_VIOLATION ("Superseded by newer connection generation")`.
  - Result: **PASSED**.

### 2. Outbox Exponential Backoff & Quarantine (`OutboxBackoffAndQuarantineIntegrationTests`)
- **Exponential Backoff**:
  - Event with `retry_count = 1` and `last_attempted_at = now()` is omitted from immediate polling while within the backoff window.
  - Result: **PASSED**.
- **Poison Event Quarantine**:
  - Event with `retry_count >= 5` is excluded from `findNextUnpublishedForUpdate`.
  - `voltgrid.outbox.quarantined` metric reflects the quarantined count.
  - `requeueQuarantinedEvents()` resets `retry_count = 0`, `last_error = null`, and `last_attempted_at = null`, safely re-enabling delivery.
  - Result: **PASSED**.

### 3. Causal Ordering & Equal Timestamp Tie-Break (`StationStatusCausalOrderingIntegrationTests`)
- **Causal Sequence Preservation**:
  - Event 1 (`seq = 1`, `status = ONLINE`) and Event 2 (`seq = 2`, `status = OCCUPIED`) have the exact same `occurredAt` timestamp.
  - Event 2 delivered first -> projection status updated to OCCUPIED (`seq = 2`).
  - Event 1 delivered second (reordered) -> projection rejects Event 1 as stale. Projection strictly retains OCCUPIED (`seq = 2`).
  - Result: **PASSED**.
- **In-Order Causal Sequence Delivery**:
  - Event 1 (`seq = 1`, `status = ONLINE`) followed by Event 2 (`seq = 2`, `status = OCCUPIED`) with identical `occurredAt` timestamps.
  - Projection sequentially advances from ONLINE (`seq = 1`) to OCCUPIED (`seq = 2`).
  - Result: **PASSED**.

## Operational Runbook: Quarantined Event Inspection & Replay

1. **Inspection**:
   - Check Prometheus metric `voltgrid.outbox.quarantined` or query database:
     ```sql
     SELECT id, aggregate_id, event_type, retry_count, last_error, last_attempted_at
     FROM outbox_events
     WHERE published_at IS NULL AND retry_count >= 5;
     ```
2. **Replay**:
   - Once underlying broker partition or network issues are resolved, invoke `OutboxRelayService.requeueQuarantinedEvents()` to reset retry counts and resume processing.


## Mixed legacy and sequenced replay regression

The PostgreSQL integration regression sends a clock-ahead legacy event and a sequenced event in both delivery orders, then replays the legacy event. It checks station status, the accepted event ID and sequence, and durable receipts for both events. Before the correction the new case failed with expected ONLINE and actual OFFLINE. After the correction, all 13 targeted ordering, handler, entity, and concurrency tests passed. Existing rows retain their schema and legacy-only projections continue using timestamps.
