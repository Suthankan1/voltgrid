# 02 — Historical Finding Disposition Matrix

> **Milestone**: VG-201
> **Baseline Commit**: `71307b68477505de9f536ed579b6344d2158b80b`
> **Verification Branch**: `verification/vg-201-core-hardening`
> **Related Issue**: [#3](https://github.com/Suthankan1/voltgrid/issues/3)

---

## 1. Disposition Classification Taxonomy

Each finding is assigned one evidence-based status:
- **Verified resolved**: Implementation confirmed by static analysis and runtime tests to completely resolve the issue.
- **Partially resolved**: Core vulnerability or defect mitigated; specific boundary cases, multi-instance limitations, or downstream schemas remain tracked.
- **Unresolved**: Finding not addressed in VG-201; scheduled for subsequent milestone.
- **Regression detected**: Hardening fix introduced a new defect or broke existing contracts.
- **Not reproducible**: Defect could not be reproduced under audited conditions.
- **False positive**: Audit finding did not represent a genuine vulnerability or bug.
- **Accepted development-only limitation**: Known constraint acceptable only in local single-developer environment.
- **Deferred to an existing milestone**: Scheduled for resolution under a specific future milestone.
- **Insufficient evidence**: Testing blocked by unavailable tools or external infrastructure.

---

## 2. Core Hardening Finding Reconciliation (Target Scope of VG-201)

| Finding ID | Previous Severity | Current Severity | Status | Verification Method | Actual Test Result | Related GitHub Issue |
|---|---|---|---|---|---|---|
| **BUG-001** | Critical | Moderate | **Partially resolved** | Unit tests + static review | Capped at 1,000,000; infinite loop eliminated; range > 100k defaults to COMPLETE | [#7](https://github.com/Suthankan1/voltgrid/issues/7) (VG-205) |
| **BUG-002** | Critical | Moderate | **Partially resolved** | Unit + integration tests | Outbox event created transactionally; multi-instance fencing missing | [#6](https://github.com/Suthankan1/voltgrid/issues/6) (VG-204) |
| **BUG-003** | High | Moderate | **Partially resolved** | Unit + live WebSocket test | Active session map protects local reconnect; distributed fencing missing | [#6](https://github.com/Suthankan1/voltgrid/issues/6) (VG-204) |
| **BUG-007** | Moderate | Low | **Verified resolved** | Docker Compose inspection | Prometheus mapped to 9091:9090; gRPC on 9090:9090; no collision | [#3](https://github.com/Suthankan1/voltgrid/issues/3) (VG-201) |
| **BUG-008** | Moderate | Low | **Verified resolved** | Unit tests | Stale older timestamps rejected; equal timestamps allowed | [#7](https://github.com/Suthankan1/voltgrid/issues/7) (VG-205) |
| **BUG-009** | Moderate | Low | **Verified resolved** | Unit + integration tests | OFFLINE stations sending Heartbeat transition to ONLINE with outbox event | [#3](https://github.com/Suthankan1/voltgrid/issues/3) (VG-201) |
| **BUG-010** | Moderate | Moderate | **Partially resolved** | Unit tests | Equal-timestamp events accepted; arrival order sensitivity remains | [#6](https://github.com/Suthankan1/voltgrid/issues/6) (VG-204) |
| **BUG-011** | Moderate | Low | **Verified resolved** | Unit + integration tests | `@Transactional` added; 255-char ID supported; DB exceptions propagate | [#3](https://github.com/Suthankan1/voltgrid/issues/3) (VG-201) |
| **SEC-006** | Moderate | Moderate | **Partially resolved** | Compose configuration inspection | `compose.yaml` bound to 127.0.0.1; `observability` compose still on 0.0.0.0 | [#5](https://github.com/Suthankan1/voltgrid/issues/5) (VG-203) |
| **DATA-001**| Moderate | Moderate | **Partially resolved** | Migration + JPA inspection | Outbox aggregate_id widened to 255; operations projection table remains 128 | [#7](https://github.com/Suthankan1/voltgrid/issues/7) (VG-205) |
| **DATA-003**| Moderate | Low | **Verified resolved** | Migration + query review | Flyway V13 composite index `(station_id, transaction_id, sequence_number ASC)` created | [#7](https://github.com/Suthankan1/voltgrid/issues/7) (VG-205) |

---

## 3. Detailed Disposition Analysis for Core Findings

### BUG-001: Integer Overflow Infinite Loop in Transaction Completeness
- **Original Problem**: `TransactionCompletenessService.findMissingSequenceNumbers` incremented `sequenceNumber++` from 0 to `lastSequenceNumber`. If `lastSequenceNumber == Integer.MAX_VALUE`, integer overflow caused an infinite loop (`Integer.MIN_VALUE <= lastSequenceNumber`), saturating CPU and exhausting memory.
- **Current Implementation**:
  - In `OcppMessageProcessor.java` (L648): added `&& request.seqNo() <= 1_000_000` to reject oversized sequence numbers at protocol ingress.
  - In `TransactionCompletenessService.java` (L167–L205): added bounds checks:
    ```java
    if (firstSequenceNumber < 0 || lastSequenceNumber < firstSequenceNumber) return List.of();
    if ((long) lastSequenceNumber - firstSequenceNumber > 100_000) return List.of();
    // In loop:
    if (sequenceNumber == Integer.MAX_VALUE) break;
    ```
  - In `V14__add_outbox_retry_and_view_protection.sql`: capped `generate_series` in view `transaction_integrity_status` to `LEAST(transaction.last_sequence_number, first_receipt.sequence_number + 10000)`.
- **Verification Evidence**:
  - `TransactionCompletenessServiceTests`: `shouldNotHangOnExtremeSequenceNumber`, `shouldHandleDuplicateSequenceNumbersInReceipts`, `shouldHandleOutOfOrderReceipts`, `shouldHandleSparseSequenceNumbersWithinLimit`, `shouldReturnEmptyMissingSequencesWhenRangeExceedsSafeLimit`.
  - `OcppMessageProcessorTests`: `shouldRejectTransactionEventWithNegativeSeqNo`, `shouldAcceptTransactionEventWithMaxAllowedSeqNo`, `shouldRejectTransactionEventWithSeqNoExceedingLimit`, `shouldRejectTransactionEventWithMaxIntegerSeqNo`.
- **Remaining Risks**:
  - When `lastSequenceNumber - firstSequenceNumber > 100_000`, `findMissingSequenceNumbers` returns `List.of()`. Because `determineStatus` treats an empty missing list as `COMPLETE`, an ended transaction with missing sequences spanning > 100,000 events is reported as `COMPLETE`.
  - Capping `seqNo` at 1,000,000 in OCPP processor means transactions cannot exceed 1,000,000 events without protocol error.
- **Traceability**: Tracked under **VG-205 (Issue #7)** for pagination, sparse representation, and data governance.

---

### BUG-002: Liveness Monitor Omits Transactional Outbox Event
- **Original Problem**: `StationLivenessService.markStaleStationsOffline` updated station status to `OFFLINE` directly in the database but did not write to `outbox_events`, resulting in permanent status desynchronization between station-service and operations-service.
- **Current Implementation**:
  - In `StationLivenessService.java`: annotated class with `@Transactional`, injected `StationStatusOutboxWriter`, and invoked `outboxWriter.save(new StationStatusChangedEvent(...))` for every stale station transition.
- **Verification Evidence**:
  - `StationLivenessServiceTests`: `shouldMarkStaleOnlineStationOffline` verifies outbox writer invocation.
  - `StationConnectivityOfflineOutboxIntegrationTests`: verified end-to-end database persistence and outbox event creation.
- **Remaining Risks**:
  - Multi-instance race condition: `stationReader.findAll()` does not use row-level locking (`SELECT ... FOR UPDATE`). If two service instances run stale detection concurrently, or if a station sends a heartbeat while stale detection runs, stale detection may overwrite fresh heartbeat state.
- **Traceability**: Single-process consistency verified. Multi-instance distributed scheduler fencing tracked under **VG-204 (Issue #6)**.

---

### BUG-003: WebSocket Reconnect Race Condition
- **Original Problem**: When a station reconnected, the new WebSocket opened before the old one closed. When the old connection closed, `afterConnectionClosed` unconditionally marked the station `OFFLINE`, overwriting the active connection status.
- **Current Implementation**:
  - In `OcppWebSocketHandler.java`: introduced `ConcurrentHashMap<String, String> activeStationSessions`.
  - On connection established: registers `activeStationSessions.put(stationId, session.getId())`.
  - On connection closed: checks `closingId != null && closingId.equals(activeId)` before calling `connectivityService.markOffline(stationId)` and removing the registration.
- **Verification Evidence**:
  - `OcppWebSocketHandlerTests`: `shouldMarkOfflineWhenActiveSessionCloses`, `shouldNotMarkOfflineWhenSupersededSessionCloses`, `shouldHandleRapidReconnectLoopsAcrossMultipleSessions`.
  - Live Docker E2E & Node.js WebSocket lifecycle test: Session 1 established (ONLINE) -> Session 2 established -> Session 1 closed -> Status verified STILL ONLINE -> Session 2 closed -> Status transitioned to OFFLINE.
- **Remaining Risks**:
  - In-memory process-local registry: `activeStationSessions` is local to a single JVM instance. In a clustered deployment behind an ALB, Session 1 on Instance A and Session 2 on Instance B would not share session ownership, allowing Instance A to prematurely mark the station offline.
- **Traceability**: Tracked under **VG-204 (Issue #6)** for distributed session registry / fencing token architecture.

---

### BUG-007: Port 9090 Conflict between Authorization Service and Prometheus
- **Original Problem**: `compose.yaml` bound authorization-service gRPC to host port 9090, while `observability/local/compose.yaml` bound Prometheus to host port 9090.
- **Current Implementation**:
  - In `observability/local/compose.yaml`: Prometheus host mapping changed to `9091:9090`.
  - In `compose.yaml`: authorization-service remains on `127.0.0.1:9090:9090`.
- **Verification Evidence**:
  - Static configuration verification; verified distinct host ports 9090 and 9091.
- **Remaining Risks**: None for port collision. (Observability 0.0.0.0 exposure tracked under SEC-006).

---

### BUG-008: Connector Status Overwrites without Timestamp Monotonicity
- **Original Problem**: `StationConnectorStatusService.updateStatus` unconditionally overwrote connector status, so out-of-order `StatusNotification` messages silently reverted newer connector states.
- **Current Implementation**:
  - In `StationConnectorStatusService.java` (L37–L41):
    ```java
    if (existing.isPresent() && existing.get().statusUpdatedAt() != null) {
        if (statusUpdatedAt.isBefore(existing.get().statusUpdatedAt())) {
            return;
        }
    }
    ```
- **Verification Evidence**:
  - `StationConnectorStatusServiceTests`: `shouldPersistConnectorStatus`, `shouldIgnoreStaleOutOfOrderConnectorStatus`, `shouldAllowConnectorStatusUpdateWhenTimestampIsEqualToExisting`, `shouldIsolateStatusUpdatesAcrossDistinctConnectors`.
- **Remaining Risks**:
  - Database read-modify-write race under concurrent updates without `@Version` optimistic locking (DATA-004).
- **Traceability**: Tracked under **VG-205 (Issue #7)** for optimistic locking.

---

### BUG-009: Heartbeat Fails to Transition Offline Stations to Online
- **Original Problem**: `StationConnectivityService.recordActivity` updated `lastSeenAt` but did not change status from `OFFLINE` to `ONLINE`, leaving stations offline despite active Heartbeat traffic.
- **Current Implementation**:
  - In `StationConnectivityService.java` (L77–L80):
    ```java
    var currentStatus = previousStatus == StationStatus.OFFLINE
            ? StationStatus.ONLINE
            : previousStatus;
    ```
    Emits `StationStatusChangedEvent` via `stationStatusOutboxWriter` if status changed.
- **Verification Evidence**:
  - `StationConnectivityServiceTests`: `shouldTransitionOfflineStationToOnlineOnRecordActivityAndEmitOutboxEvent`.
  - `StationConnectivityOutboxIntegrationTests`: verifies DB update and outbox row insertion.
- **Remaining Risks**: None in core logic. Unauthenticated station heartbeat spoofing tracked under SEC-001 (VG-202).

---

### BUG-010: Equal-Timestamp Events Dropped in Operations Status Projection
- **Original Problem**: `StationStatusProjectionEntity.apply` used `!statusChangedAt.isAfter(this.statusChangedAt)`, which rejected events with equal timestamps, dropping state transitions occurring within the same millisecond.
- **Current Implementation**:
  - In `StationStatusProjectionEntity.java` (L119): updated to `if (statusChangedAt.isBefore(this.statusChangedAt)) return false;`.
- **Verification Evidence**:
  - `StationStatusProjectionEntityTests`: `shouldAcceptEqualTimestampWithDistinctEventId`, `shouldRejectDuplicateEventId`, `shouldDemonstrateEqualTimestampArrivalOrderSensitivity`.
- **Remaining Risks**:
  - Lack of causal determinism: Reversing delivery order of two equal-timestamp events produces inverted final status (last-write-wins).
- **Traceability**: Tracked under **VG-204 (Issue #6)** for aggregate versioning and ordering.

---

### BUG-011: Missing @Transactional on Station Registration
- **Original Problem**: `StationRegistrationService.register` had no `@Transactional` annotation.
- **Current Implementation**:
  - Annotated `register` with `@Transactional`.
  - Input validation enforced via `@NotBlank` and `@Size(max = 255)`.
- **Verification Evidence**:
  - `StationRegistrationServiceTests`: `shouldRegisterNewStationAsOffline`, `shouldRejectDuplicateStationId`, `shouldRegisterStationWithMaximumLengthIdentifier`, `shouldPropagateExceptionWhenDatabaseWriterFails`.
- **Remaining Risks**: Concurrent registration requests with identical IDs both passing `findById` before commit result in `DataIntegrityViolationException` from PostgreSQL primary key constraint.
- **Traceability**: Verified resolved for VG-201.

---

### SEC-006: Docker Compose Ports Bound to Wildcard Interface
- **Original Problem**: Local services in `compose.yaml` bound to `0.0.0.0`, exposing dev databases, Kafka, and microservices to the local network.
- **Current Implementation**:
  - `compose.yaml`: prefixed ports with `127.0.0.1:` (8080, 8081, 9090).
  - `infrastructure/local/postgres/compose.yaml`: prefixed all Postgres (5434, 5435, 5436) and Kafka (9092, 29092) ports with `127.0.0.1:`.
  - `observability/local/compose.yaml`: ports 16686, 4317, 4318, 9091 remain bound to wildcard interface `0.0.0.0`.
- **Verification Evidence**: Inspected Compose definitions.
- **Remaining Risks**: Observability endpoints exposed to local LAN.
- **Traceability**: Tracked under **VG-203 (Issue #5)**.

---

### DATA-001: Station ID Column Width Mismatch
- **Original Problem**: `charging_stations.id` was VARCHAR(255) while `outbox_events.aggregate_id` was VARCHAR(128). An ID > 128 characters broke outbox publishing.
- **Current Implementation**:
  - Flyway migration `V12__widen_outbox_aggregate_id.sql` widened `outbox_events.aggregate_id` to VARCHAR(255).
  - However, `station_status_projections.station_id` in `operations-service` remains `VARCHAR(128)`.
- **Verification Evidence**: SQL migration inspection and entity validation.
- **Remaining Risks**: Station IDs between 129 and 255 characters cause projection insertion failure in operations-service.
- **Traceability**: Tracked under **VG-205 (Issue #7)**.

---

### DATA-003: Missing Composite Index on Meter Samples
- **Original Problem**: `transaction_meter_samples` lacked a composite index matching `findByStationIdAndTransactionIdOrderBySequenceNumberAsc`.
- **Current Implementation**:
  - Flyway migration `V13__add_meter_samples_composite_index.sql` added:
    `CREATE INDEX IF NOT EXISTS idx_meter_samples_station_tx_seq ON transaction_meter_samples (station_id, transaction_id, sequence_number ASC);`
- **Verification Evidence**: SQL migration inspection and query plan alignment.
- **Remaining Risks**: Table retention lifecycle and sample pagination tracked under VG-205.
- **Traceability**: Verified resolved for VG-201.

---

## 4. Reconciled Status of All Other Historical Findings

| Finding ID | Title | Historical Milestone | Current Status | Notes / Tracking Issue |
|---|---|---|---|---|
| SEC-001 | Unauthenticated OCPP WebSocket Endpoint | VG-202 | **Unresolved** | Critical gate for VG-202 ([#4](https://github.com/Suthankan1/voltgrid/issues/4)) |
| SEC-002 | Zero Backend Authentication across GraphQL and gRPC | VG-202 | **Partially resolved** | Basic filter added in 18d4ddc; OIDC/JWT RBAC required in VG-202 ([#4](https://github.com/Suthankan1/voltgrid/issues/4)) |
| SEC-003 | HMAC Key Hardcoded Fallback | VG-202 | **Unresolved** | Cloud secrets injection required in VG-202 ([#4](https://github.com/Suthankan1/voltgrid/issues/4)) |
| SEC-004 | Plaintext In-Transit Transport | VG-203 | **Unresolved** | TLS/WSS required in VG-203 ([#5](https://github.com/Suthankan1/voltgrid/issues/5)) |
| SEC-005 | Public Subnet Placement in Terraform | VG-203 | **Unresolved** | Private subnet relocation in VG-203 ([#5](https://github.com/Suthankan1/voltgrid/issues/5)) |
| BUG-004 | Outbox Relay Poison-Pill Vulnerability | VG-204 | **Partially resolved** | Retry columns added in V14; dead-letter queue required in VG-204 ([#6](https://github.com/Suthankan1/voltgrid/issues/6)) |
| BUG-005 | Unbounded GraphQL Queries | VG-205 | **Unresolved** | Pagination & depth limits required in VG-205 ([#7](https://github.com/Suthankan1/voltgrid/issues/7)) |
| BUG-006 | Multi-Instance Outbox Claim Inversion | VG-204 | **Unresolved** | Station-keyed partitioning required in VG-204 ([#6](https://github.com/Suthankan1/voltgrid/issues/6)) |
| DATA-002 | Transaction Integrity View Series Explosion | VG-205 | **Partially resolved** | View capped at 10k in V14; pagination required in VG-205 ([#7](https://github.com/Suthankan1/voltgrid/issues/7)) |
| DATA-004 | Absence of Optimistic Locking Across JPA Entities | VG-205 | **Unresolved** | `@Version` fields required in VG-205 ([#7](https://github.com/Suthankan1/voltgrid/issues/7)) |
| INF-001 | Actuator Ingress Exposure | VG-203 | **Unresolved** | Network restriction in VG-203 ([#5](https://github.com/Suthankan1/voltgrid/issues/5)) |
| INF-002 | Flyway V8 Version Gap | VG-205 | **Accepted** | Sequence jump harmless in Flyway; documented in VG-205 ([#7](https://github.com/Suthankan1/voltgrid/issues/7)) |
| INF-003 | CI Actions Unpinned | VG-206 | **Partially resolved** | Pinned in security workflow; remaining in VG-206 ([#8](https://github.com/Suthankan1/voltgrid/issues/8)) |
| INF-004 | Zero Automated Security Scanners | VG-206 | **Partially resolved** | Gitleaks action added; CodeQL/Trivy required in VG-206 ([#8](https://github.com/Suthankan1/voltgrid/issues/8)) |
| INF-005 | Missing CI Concurrency Constraints | VG-206 | **Verified resolved** | Concurrency groups added to all workflows |
| OBS-001 | OpenTelemetry Agent Excluded from Production Containers | VG-207 | **Unresolved** | Container packaging required in VG-207 ([#9](https://github.com/Suthankan1/voltgrid/issues/9)) |
| OBS-002 | Absence of Domain Metrics on Auth Service | VG-207 | **Partially resolved** | Micrometer added in 18d4ddc; custom SLIs in VG-207 ([#9](https://github.com/Suthankan1/voltgrid/issues/9)) |
| OBS-003 | Zero Alerting Rules or Alertmanager Configuration | VG-207 | **Partially resolved** | alerts.yml created; Alertmanager setup in VG-207 ([#9](https://github.com/Suthankan1/voltgrid/issues/9)) |
| GAP-001–006 | OCPP 2.0.1 Core Operations Feature Gaps | VG-208 | **Unresolved** | Scheduled for milestone VG-208 ([#10](https://github.com/Suthankan1/voltgrid/issues/10)) |
| TEST-001 | Absence of Concurrency and Reconnection Race Tests | VG-201 | **Verified resolved** | Concurrency tests added to station-service and operations-service |
| TEST-002 | Absence of Protocol Bounds and Sequence Fuzzing Tests | VG-201 | **Verified resolved** | Sequence boundary tests added to OcppMessageProcessorTests |
