# ADR 0012: Distributed Reliability, Causal Ordering, and Multi-Instance Fencing

## Status

Accepted

## Context

VoltGrid requires robust distributed reliability across multi-instance deployments of `station-service` and `operations-service` communicating over Apache Kafka (Milestone #6, issue [#6](https://github.com/Suthankan1/voltgrid/issues/6)).

The distributed architecture introduces several concurrency and network failure modes:
1. **At-Least-Once Delivery & Duplicates**: Network interruptions, broker rollbacks, and producer retries can deliver the same outbox event multiple times at distinct offsets.
2. **Reordering and Equal Timestamps**: High-frequency status changes can occur within the same millisecond or be reordered during transit or relay retries. Inferring causal order from timestamps or random UUIDs alone risks stale projection overwrites.
3. **Multi-Instance Station Connections (Split-Brain Disconnects)**: In a clustered environment where multiple Station Service instances run behind a load balancer, an EVSE may reconnect to Instance B while Instance A is tearing down the previous socket or handling a heartbeat timeout. If Instance A blindly marks the station offline on socket closure, it overwrites Instance B's active connection state.
4. **Outbox Poison Events & Unbounded Retries**: A persistently failing event (e.g. schema violation or broken broker partition) must not spin-lock the outbox relay. It requires bounded exponential backoff, dead-letter quarantine after exceeding retry thresholds, and safe operator replay mechanisms.

## Decision

### 1. Partitioning and Ordering Contract
- **Aggregate Partition Key**: All outbox events for charging stations must use `stationId` as the Kafka partition key. This guarantees that events for any individual station are delivered in order within a single Kafka topic partition.
- **At-Least-Once Semantics**: The system guarantees at-least-once delivery from Station outbox to Kafka, and at-least-once consumption in Operations. Operations Service must maintain strictly idempotent event handling.

### 2. Causal Ordering and Deterministic Tie-Breaks
- Each charging station aggregate maintains a monotonic `status_sequence_number` incremented on each status mutation.
- `StationStatusChangedEvent` carries the `sequenceNumber`.
- `StationStatusProjectionEntity` records `last_sequence_number`. Incoming events are evaluated as follows:
  - If `sequenceNumber > 0` and `lastSequenceNumber > 0`: strictly require `sequenceNumber > lastSequenceNumber`. Any event with `sequenceNumber <= lastSequenceNumber` is discarded as stale.
  - If unversioned (`sequenceNumber == 0`): preserves backwards compatibility by evaluating `statusChangedAt.isBefore(this.statusChangedAt)`. Newer causal sequence numbers strictly supersede unversioned events.

### 3. Multi-Instance Connection Generation Fencing
- Each charging station aggregate maintains a monotonic `connection_generation` in `charging_stations`.
- When an EVSE establishes a WebSocket connection, Station Service atomically increments and records the active `connection_generation` for that station and attaches it to the WebSocket session attributes.
- On connection close (`afterConnectionClosed`), Station Service executes `markOfflineIfGenerationMatches(stationId, sessionGeneration)`. If the database indicates `currentGeneration != sessionGeneration`, the disconnect was superseded by a newer connection on another instance (or the same instance) and is discarded without marking the station offline.
- Messages received on a session whose generation is superseded are terminated with `CloseStatus.POLICY_VIOLATION`.

### 4. Bounded Relay Leases, Backoff, and Quarantine
- Unsuccessful outbox relay attempts record `last_error` and `last_attempted_at`, incrementing `retry_count`.
- Relay polling enforces bounded exponential backoff (`last_attempted_at + backoff <= now()`) so failed records do not starve healthy queue processing.
- Events reaching maximum retries (5) are quarantined from the active relay queue.
- A controlled replay operation allows resetting `retry_count = 0` for quarantined events after diagnosing upstream issues.

### 5. Durable Consumer Receipts and Atomic Projections
- Operations Service records event processing in `processed_event_receipts` using an atomic `INSERT ... ON CONFLICT DO NOTHING`.
- If receipt insertion returns 0 rows updated, the duplicate record is skipped immediately.
- Projection updates execute within the same database transaction; any projection failure rolls back the receipt to allow consumer redelivery.

## Consequences

### Positive
- Prevents stale projection overwrites during reordered deliveries or equal-timestamp events.
- Eliminates split-brain offline transitions when chargers reconnect across different nodes in multi-instance deployments.
- Prevents poison events from exhausting relay resources through exponential backoff and quarantine.
- Fully preserves backwards compatibility with existing database rows and unversioned fixtures.

### Negative
- Requires maintaining `status_sequence_number` and `connection_generation` on charging station entities.
- Slightly higher database write concurrency for tracking connection generations.
