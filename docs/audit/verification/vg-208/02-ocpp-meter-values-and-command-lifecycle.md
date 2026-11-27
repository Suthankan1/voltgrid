# VG-208 Verification Report: OCPP 2.0.1 Core Charging Operations and Metering

- **Issue**: [Issue #10: [VG-208][P0] OCPP 2.0.1 core charging operations and metering](https://github.com/Suthankan1/voltgrid/issues/10)
- **Branch**: `feat/vg-208-ocpp-charging-operations`
- **Scope**: Audit findings GAP-001, GAP-002, GAP-003.

---

## 1. Summary of Delivered Architecture

1. **Standalone MeterValues Ingestion (GAP-001)**:
   - Created `station_meter_values` table via Flyway migration `V21__create_station_meter_values_and_command_lifecycle.sql`.
   - Captures telemetry independent of transaction status with `station_id`, `evse_id`, `sampled_at`, `raw_value`, `normalized_value`, `unit`, `unit_multiplier`, `phase`, `measurand`, `context`, and `location`.
   - Full RFC3339 timezone offset parsing support (`OffsetDateTime` / `Instant`).
   - Normalization accounting for `unit_multiplier` ($raw \times 10^{multiplier}$) and unit conversion (e.g. `kWh` -> `Wh`).
   - Idempotent deduplication via unique index `uq_station_meter_values_sample` preventing duplicate insertions on late/retransmitted frames.

2. **Durable Outbound CALL Correlation and Command Lifecycle (GAP-002)**:
   - Created `station_commands` table tracking every outbound CALL message by `station_id` and unique `message_id`.
   - Implemented `StationCommandService` and `OcppCommandSender` gateway.
   - Lifecycle state machine: `REQUESTED` -> `PENDING` -> `ACCEPTED` / `REJECTED` -> `OBSERVED` (with `TIMED_OUT` and `UNCERTAIN` transitions).
   - Idempotency key deduplication: identical requests return the existing command without re-transmitting.

3. **Separation of Command Acceptance from Physical Charging (GAP-003)**:
   - Safety invariant: Charger `CALL_RESULT` with `{"status": "Accepted"}` transitions command to `ACCEPTED` but never starts billing or records physical charging.
   - Command transitions to `OBSERVED` exclusively upon reception and validation of `TransactionEvent(eventType: "Started")` or `TransactionEvent(eventType: "Ended")`.

4. **Architecture Decision Record**:
   - Delivered ADR 0016: `docs/adr/0016-ocpp-meter-values-and-command-lifecycle.md` (indexed in `docs/adr/README.md`).

---

## 2. Automated Verification Evidence

### Standalone MeterValues Integration Test
- **Test**: `StationMeterValueIntegrationTests.java`
  - `shouldIngestStandaloneMeterValuesWithRfc3339OffsetAndUnitNormalization`: Validates RFC3339 offset `+05:30` parsing, EVSE provenance, raw value `12.5 kWh` normalized to `12500 Wh`.
  - `shouldHandleDuplicateAndLateSamplesIdempotently`: Transmits identical samples; verifies deduplication without exceptions or double-counting.
  - `shouldRejectInvalidEvseIdInMeterValues`: Asserts negative `evseId` is rejected with `FormatViolation`.
- **Output**:
  ```
  Tests run: 3, Failures: 0, Errors: 0, Skipped: 0
  BUILD SUCCESS
  ```

### Station Command Lifecycle Integration Test
- **Test**: `StationCommandLifecycleIntegrationTests.java`
  - `shouldExecuteFullCommandLifecycleForRequestStartTransaction`:
    - Step 1: Dispatches `RequestStartTransaction` -> status `PENDING`.
    - Step 2: Idempotent re-invocation returns existing command record.
    - Step 3: Station responds `CALL_RESULT [3, ..., {"status":"Accepted"}]` -> status `ACCEPTED`, `observedAt` is null (not charging).
    - Step 4: Station sends `TransactionEvent(Started)` -> command correlates and transitions to `OBSERVED`.
  - `shouldExecuteFullCommandLifecycleForRequestStopTransaction`: Dispatches `RequestStopTransaction`, verifies `ACCEPTED`, and confirms transition to `OBSERVED` when `TransactionEvent(Ended)` arrives.
  - `shouldRejectCommandWhenStationIsDisconnected`: Verifies immediate `REJECTED` transition when station session is not connected.
  - `shouldTransitionToRejectedOnCallError`: Verifies transition to `REJECTED` upon receiving `CALL_ERROR [4, ...]`.
- **Output**:
  ```
  Tests run: 4, Failures: 0, Errors: 0, Skipped: 0
  BUILD SUCCESS
  ```

### Flyway Schema Evolution Verification
- **Test**: `HistoricalStationMigrationTests.java`
- **Output**:
  ```
  Tests run: 10, Failures: 0, Errors: 0, Skipped: 0
  BUILD SUCCESS (Schema at v21)
  ```
