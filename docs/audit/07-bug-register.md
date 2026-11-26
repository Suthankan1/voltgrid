# 07 — Bug Register

> **Audit**: VG-200 · **Commit**: `e6bf891` · **Date**: 2026-11-26

## BUG-001 · Integer overflow infinite loop in TransactionCompletenessService (Critical)

| Field | Value |
|---|---|
| **Severity** | Critical |
| **Confidence** | Confirmed by static analysis |
| **Component** | station-service |
| **File** | `services/station-service/src/main/java/com/voltgrid/station/application/TransactionCompletenessService.java` |
| **Audited commit** | `e6bf891` |

**Description**: `findMissingSequenceNumbers()` iterates `for (int sequenceNumber = 0; sequenceNumber <= lastSequenceNumber; sequenceNumber++)`. When `lastSequenceNumber == Integer.MAX_VALUE` (2,147,483,647), the increment wraps to `Integer.MIN_VALUE`, creating an infinite loop that never terminates. This can be triggered by a single OCPP `TransactionEvent` with `seqNo` set to `Integer.MAX_VALUE`.

**Root cause**: No upper-bound validation on `seqNo` from OCPP messages.

**Impact**: JVM thread exhaustion, OOM, or CPU saturation. Any GraphQL query that invokes `transactionCompleteness` for the affected transaction triggers the loop.

**Remediation**: Add `seqNo` bounds check in `OcppMessageProcessor` (reject values > reasonable max, e.g., 1,000,000). Add `lastSequenceNumber` guard in `findMissingSequenceNumbers()`.

---

## BUG-002 · Liveness monitor does not write outbox events (Critical)

| Field | Value |
|---|---|
| **Severity** | Critical |
| **Confidence** | Confirmed by static analysis |
| **Component** | station-service |
| **File** | `services/station-service/src/main/java/com/voltgrid/station/application/StationLivenessService.java` |
| **Audited commit** | `e6bf891` |

**Description**: `markStaleStationsOffline()` updates station status to `OFFLINE` in the database but does **not** write a `StationStatusChangedEvent` to the outbox. Compare with `StationConnectivityService.markOffline()` which correctly writes outbox events. The operations-service projection never receives the status change.

**Root cause**: `StationLivenessService` calls `stationWriter.save()` directly without using `StationStatusOutboxWriter`.

**Impact**: After liveness timeout, station-service shows `OFFLINE` but operations-service and the operator dashboard show stale `ONLINE` indefinitely. Only a WebSocket reconnect and disconnect corrects the divergence.

**Remediation**: Inject `StationStatusOutboxWriter` into `StationLivenessService` and write outbox events for each stale station transition, matching the pattern in `StationConnectivityService.markOffline()`.

---

## BUG-003 · WebSocket disconnect race condition (High)

| Field | Value |
|---|---|
| **Severity** | High |
| **Confidence** | Confirmed by static analysis |
| **Component** | station-service |
| **File** | `services/station-service/src/main/java/com/voltgrid/station/api/ocpp/OcppWebSocketHandler.java` L69–L84 |
| **Audited commit** | `e6bf891` |

**Description**: When a station reconnects (opens new WebSocket before old one closes), `afterConnectionClosed()` on the old session calls `connectivityService.markOffline(stationId)` after the new session has already called `markOnline()`. No session ownership tracking exists. The station is marked OFFLINE despite having an active connection.

**Root cause**: No `ConcurrentHashMap<String, WebSocketSession>` or similar session registry to track the current active session per station.

**Impact**: Station status flickers between ONLINE and OFFLINE on reconnection. Outbox events propagate incorrect status to operations-service.

**Remediation**: Track active session ID per station. In `afterConnectionClosed()`, only mark offline if the closing session matches the currently registered active session.

---

## BUG-004 · Outbox relay head-of-line blocking / poison pill (High)

| Field | Value |
|---|---|
| **Severity** | High |
| **Confidence** | Confirmed by static analysis |
| **Component** | station-service |
| **File** | `services/station-service/src/main/java/com/voltgrid/station/messaging/outbox/OutboxRelayService.java` |
| **Audited commit** | `e6bf891` |

**Description**: The outbox relay fetches unprocessed events ordered by `createdAt` and publishes them to Kafka. If publishing a single event fails (Kafka timeout, serialization error), no retry count is tracked and no dead-letter mechanism exists. The failed event blocks the head of the queue permanently, preventing all subsequent events from being relayed.

**Root cause**: No `retryCount` column, no maximum retry limit, no dead-letter table.

**Impact**: A single undeliverable event stops all event propagation from station-service to operations-service.

**Remediation**: Add `retry_count` and `last_error` columns to `outbox_events`. After N retries, move to `outbox_dead_letters` table and continue processing.

---

## BUG-005 · Unbounded GraphQL queries (High)

| Field | Value |
|---|---|
| **Severity** | High |
| **Confidence** | Confirmed by static analysis |
| **Component** | station-service, operations-service |
| **Files** | `StationGraphQlController.java`, `StationTransactionGraphQlController.java`, `station.graphqls` |
| **Audited commit** | `e6bf891` |

**Description**: The following GraphQL queries return complete, unbounded lists:
- `stations` — all stations
- `transactions` — all transactions
- `stationTransactions(stationId)` — all transactions for a station
- `transactionMeterSamples(stationId, transactionId)` — all samples
- `networkTransactions` — all network transactions

Only `networkTransactionPage` implements pagination. GraphQL introspection is enabled with no depth, complexity, or batch limits.

**Impact**: A single query can exhaust server memory and database connection pool with large datasets.

**Remediation**: Add cursor or offset pagination to all list queries. Set `spring.graphql.graphiql.enabled=false` in production. Add query depth and complexity limits.

---

## BUG-006 · SKIP LOCKED outbox per-aggregate ordering violation (High)

| Field | Value |
|---|---|
| **Severity** | High |
| **Confidence** | Confirmed by static analysis |
| **Component** | station-service |
| **File** | `services/station-service/src/main/java/com/voltgrid/station/messaging/outbox/OutboxEventRepository.java` |
| **Audited commit** | `e6bf891` |

**Description**: The outbox relay uses `SELECT ... ORDER BY created_at ... FOR UPDATE SKIP LOCKED` to claim events. With multiple relay instances, two instances can claim events for the same aggregate in parallel, delivering them to Kafka out of `created_at` order per aggregate.

**Impact**: Operations-service may apply ONLINE→OFFLINE events in wrong order, corrupting projection state.

**Remediation**: Partition outbox relay by aggregate key (station ID), or use Kafka key-based ordering with single-partition-per-station topic design.

---

## BUG-007 · Port 9090 conflict (Moderate)

| Field | Value |
|---|---|
| **Severity** | Moderate |
| **Component** | Docker Compose |
| **Files** | `compose.yaml` (authorization-service: 9090), `observability/local/compose.yaml` (Prometheus: 9090) |

**Description**: Authorization-service gRPC and Prometheus both use port 9090, preventing simultaneous operation.

**Remediation**: Change Prometheus to 9091 or authorization-service to 9093.

---

## BUG-008 · Connector status overwrites without timestamp monotonicity (Moderate)

| Field | Value |
|---|---|
| **Component** | station-service |
| **File** | `services/station-service/src/main/java/com/voltgrid/station/application/StationConnectorStatusService.java` |

**Description**: `updateStatus()` unconditionally overwrites the connector status without checking if the incoming `StatusNotification` timestamp is newer than the stored `statusUpdatedAt`. Out-of-order delivery silently regresses the status.

**Remediation**: Compare timestamps and reject older updates.

---

## BUG-009 · recordActivity does not transition OFFLINE→ONLINE (Moderate)

| Field | Value |
|---|---|
| **Component** | station-service |
| **File** | `services/station-service/src/main/java/com/voltgrid/station/application/StationConnectivityService.java` |

**Description**: `recordActivity()` (called on Heartbeat) updates `lastSeenAt` but does not check or transition station status. A station marked OFFLINE by liveness monitor continues sending Heartbeats but stays OFFLINE in the database.

**Remediation**: Add status transition check in `recordActivity()`.

---

## BUG-010 · Equal-timestamp events silently dropped (Moderate)

| Field | Value |
|---|---|
| **Component** | operations-service |

**Description**: `StationStatusProjectionEntity.apply()` uses `!statusChangedAt.isAfter(this.statusChangedAt)` which rejects events with equal timestamps. Events occurring in the same millisecond are dropped.

**Remediation**: Use `isBefore()` guard instead (reject only strictly older).

---

## BUG-011 · Missing @Transactional on station registration (Moderate)

| Field | Value |
|---|---|
| **Component** | station-service |
| **File** | `services/station-service/src/main/java/com/voltgrid/station/application/StationRegistrationService.java` |

**Description**: `StationRegistrationService.register()` checks for existing station and then saves a new one, but is not annotated `@Transactional`. Concurrent duplicate registration requests can both pass the existence check and create duplicate entries (or throw on unique constraint, depending on JPA flush timing).

**Remediation**: Add `@Transactional` and handle `DataIntegrityViolationException`.
