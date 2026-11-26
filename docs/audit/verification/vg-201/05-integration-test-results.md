# 05 — Integration Test Results

> **Milestone**: VG-201
> **Environment**: Isolated Docker Compose Stack `voltgrid-vg201-verification`
> **Configuration Files**: `compose.yaml`, `compose.operator-test.yaml`, `infrastructure/local/postgres/compose.yaml`
> **Execution Date**: 2026-11-26

---

## 1. Local Compose Architecture and Isolation

To perform live integration verification without conflicting with host developer services or modifying existing databases, an isolated Compose project was launched:

```bash
docker compose -p voltgrid-vg201-verification \
  -f compose.yaml \
  -f compose.operator-test.yaml \
  up -d --build
```

### Port and Network Isolation
Using `compose.operator-test.yaml`, all internal database and Kafka host ports were disabled (`ports: !override []`), and backend entrypoints were bound exclusively to loopback test ports:
- **Station Service**: `127.0.0.1:18080` (HTTP / GraphQL / WebSocket)
- **Operations Service**: `127.0.0.1:18081` (HTTP / GraphQL)
- **Authorization Service**: Internal gRPC on `authorization-service:9090` (no host publishing)
- **Databases**: `postgres`, `authorization-postgres`, `operations-postgres` isolated within `voltgrid-vg201-verification_default` bridge network
- **Event Bus**: Apache Kafka 4.2.1 isolated internally on `kafka:29092`

---

## 2. Container Startup and Health Status

All containers started, initialized schema migrations, and reported healthy status:

| Container Name | Image | Service | Status | Health Check |
|---|---|---|---|---|
| `voltgrid-vg201-verification-postgres-1` | `postgres:18.6` | `postgres` | Up (healthy) | `pg_isready -U voltgrid -d voltgrid_station` |
| `voltgrid-vg201-verification-authorization-postgres-1` | `postgres:18.6` | `authorization-postgres` | Up (healthy) | `pg_isready -U voltgrid -d voltgrid_authorization` |
| `voltgrid-vg201-verification-operations-postgres-1` | `postgres:18.6` | `operations-postgres` | Up (healthy) | `pg_isready -U voltgrid -d voltgrid_operations` |
| `voltgrid-vg201-verification-kafka-1` | `apache/kafka:4.2.1` | `kafka` | Up (healthy) | `kafka-broker-api-versions.sh` |
| `voltgrid-vg201-verification-kafka-init-1` | `apache/kafka:4.2.1` | `kafka-init` | Exited (0) | Topic initialization completed successfully |
| `voltgrid-vg201-verification-authorization-service-1` | Local build | `authorization-service` | Up (healthy) | `grpc_health_probe -addr=127.0.0.1:9090` |
| `voltgrid-vg201-verification-operations-service-1` | Local build | `operations-service` | Up | Actuator health: `{"status":"UP"}` |
| `voltgrid-vg201-verification-station-service-1` | Local build | `station-service` | Up | Actuator health: `{"status":"UP"}` |

---

## 3. End-to-End Lifecycle Verification Steps

The 20-step lifecycle was executed and validated:

| Step | Operation | Protocol / Transport | Observed Result | Evidence |
|---|---|---|---|---|
| 1 | Station registration | GraphQL `registerStation` on port 18080 | Returns station with status `OFFLINE` | Confirmed via GraphQL response |
| 2 | OCPP WebSocket connection | `ws://127.0.0.1:18080/ocpp/{id}` (`ocpp2.0.1`) | Handshake accepted (HTTP 101 Switching Protocols) | Active session registered |
| 3 | BootNotification | OCPP CALL `[2, id, "BootNotification", ...]` | Returns CALLRESULT `Accepted`, interval 300s | Station marked `ONLINE` in station-service |
| 4 | Station online status | Station Service GraphQL query `station(id)` | Status evaluates to `ONLINE` | Returned in query response |
| 5 | Heartbeat | OCPP CALL `[2, id, "Heartbeat", {}]` | Returns CALLRESULT with `currentTime` | `lastSeenAt` timestamp updated |
| 6 | Connector status notification | OCPP CALL `StatusNotification` (EVSE 1, Conn 1 Available; Conn 2 Faulted) | Connector state persisted with monotonic timestamp | Queried via `stationConnectors` GraphQL |
| 7 | Authorization through gRPC | OCPP CALL `Authorize` (idToken `UNREGISTERED-E2E`) | Station-service calls authorization-service via gRPC; returns `Invalid` | Authorization contract confirmed |
| 8 | Transaction start | OCPP CALL `TransactionEvent` (`Started`, seqNo 0) | Transaction created in DB; outbox event emitted | Transaction ID confirmed |
| 9 | Transaction update | OCPP CALL `TransactionEvent` (`Updated`, seqNo 1) | Transaction updated | Meter values associated |
| 10 | Meter sample ingestion | `meterValue` array with `Power.Active.Import` and `Energy.Active.Import.Register` | Persisted into `transaction_meter_samples` | Queried via `transactionMeterSamples` |
| 11 | Transaction end | OCPP CALL `TransactionEvent` (`Ended`, seqNo 2) | Transaction status transitioned to `ENDED` | End time and lastSequenceNumber recorded |
| 12 | Transaction completeness | GraphQL `transactionCompleteness` resolver | Evaluates status to `COMPLETE`, missingSequenceNumbers `[]` | Technical audit verifies 0 missing |
| 13 | Incomplete transaction test | Started (seq 0) + Ended (seq 2) omitting seq 1 | Evaluates status to `INCOMPLETE`, missing `[1]` | Flagged in `/attention` view |
| 14 | Transactional outbox | `outbox_events` table in PostgreSQL | Status transition events written transactionally | Relay reads unpublished events |
| 15 | Kafka event delivery | `voltgrid.station-status-changed.v1` topic | Outbox relay publishes event with aggregate key | Consumed by operations-service |
| 16 | Operations projection | `station_status_projections` table | Projection updated with new status and `last_event_id` | Read model verified |
| 17 | GraphQL projection query | Operations Service GraphQL `stationStatus(id)` | Returns `currentStatus: "ONLINE"` on port 18081 | Matches station-service status |
| 18 | Operator UI visibility | Next.js operator console on `http://127.0.0.1:4312` | Station appears in directory, connectors view, session graph | Playwright live test verified |
| 19 | Station disconnect & offline | WebSocket close | Station marked `OFFLINE`; outbox event published; operations projection updates to `OFFLINE` | Verified in `/attention` and `/diagnostics` |
| 20 | Reconnection & recovery | Reconnect new WebSocket Session 2 before Session 1 closes | Station remains `ONLINE` when Session 1 closes; transitions `OFFLINE` only when Session 2 closes | Active session ownership confirmed |

---

## 4. Controlled Dependency Interruption and Recovery Test

A controlled interruption drill was executed against the message bus:
1. **Interruption**: Apache Kafka container paused:
   ```bash
   docker compose -p voltgrid-vg201-verification pause kafka
   ```
2. **Impact Observation**:
   - `station-service` continued accepting OCPP WebSocket messages and HTTP GraphQL queries without crashing.
   - Outbox events accumulated in `outbox_events` table with `published_at IS NULL`.
3. **Restoration**: Apache Kafka unpaused:
   ```bash
   docker compose -p voltgrid-vg201-verification unpause kafka
   ```
4. **Recovery Observation**:
   - Outbox relay resumed polling and successfully published buffered events.
   - Health probes on both services returned healthy:
     - `http://127.0.0.1:18080/actuator/health` -> `{"status":"UP"}`
     - `http://127.0.0.1:18081/actuator/health` -> `{"status":"UP"}`

---

## 5. Teardown and Resource Cleanup

Following verification, all isolated containers, networks, and named test volumes were destroyed cleanly:

```bash
docker compose -p voltgrid-vg201-verification -f compose.yaml -f compose.operator-test.yaml down -v
```

Output confirmed:
- Containers removed: `station-service`, `operations-service`, `authorization-service`, `postgres`, `authorization-postgres`, `operations-postgres`, `kafka`, `kafka-init`.
- Volumes removed: `station-postgres-data`, `operations-postgres-data`, `authorization-postgres-data`.
- Bridge network removed: `voltgrid-vg201-verification_default`.
- Verification via `docker ps` confirmed 0 lingering containers. No unrelated developer or host docker resources were affected.
