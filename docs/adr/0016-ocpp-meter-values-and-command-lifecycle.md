# 0016. OCPP 2.0.1 Standalone MeterValues Ingestion and Outbound Command Lifecycle

## Status

Approved (Amended for VG-208 Remediation)

## Context

VoltGrid operates commercial EV charging stations adhering to OCPP 2.0.1. Under the VG-200 architecture audit and subsequent independent acceptance review of commit `cf3912a`, several critical lifecycle and data integrity defects were identified and remediated:

1. **GAP-001 (Standalone MeterValues Ingestion & Precision Deduplication)**:
   - Meter deduplication originally omitted measurement `location` (e.g. `Inlet` vs `Outlet`), causing distinct co-sampled readings to collide.
   - Multipliers lacked bounded validation, creating exponentiation and CPU/memory exhaustion risk ($raw \times 10^{multiplier}$).
   - Conflicting duplicate samples lacked safe deterministic resolution.
2. **GAP-002 (Outbound Command State Machine & Correlation)**:
   - Start command correlation improperly selected the latest accepted start command instead of matching the intended `remoteStartId` (OCPP 2.0.1 `TransactionEvent.transactionInfo.remoteStartId`). Unrelated or local card taps could improperly correlate with CSMS remote commands.
   - Stop command correlation selected the latest stop command rather than matching `transactionId`.
   - Commands were dispatched over WebSocket inside uncommitted database transactions, causing wire frames to be transmitted even if DB transactions rolled back.
   - Raw RFID `idToken` credentials were persisted in plain text in `payload` column, violating credential leakage policy.
   - Response handling could overwrite terminal (`TIMED_OUT`, `REJECTED`, `UNCERTAIN`) or `OBSERVED` states on late `CALL_RESULT` or `CALL_ERROR` frames.
   - Session disconnects while commands were pending did not transition state to `UNCERTAIN`.
   - Invalid `remoteStartId` silently fell back to `1`.
   - Idempotency lacked concurrency protection and conflicting request payload detection.
3. **GAP-003 (Premature Charging Commencement Assumption)**:
   - In physical charging operations, a charging station's `CALL_RESULT` response containing `status: "Accepted"` merely indicates instruction receipt; it does *not* indicate physical current flow.
   - Transition to `OBSERVED` occurs exclusively when corroborated by matching transaction events.
4. **GAP-004 (Bounded Tenant-Scoped Access)**:
   - Meter values and command query interfaces were unbounded and lacked tenant organization authorization checks.

## Decision

We establish an immutable, hardened OCPP 2.0.1 MeterValues ingestion and outbound command lifecycle framework:

### 1. Hardened Meter Values Schema & Ingestion
- Database migration `V22__harden_meter_values_and_command_correlation.sql`:
  - Recreates unique index `uq_station_meter_values_sample` with `COALESCE(location, 'NONE')` alongside station, EVSE, sampledAt, measurand, phase, and context.
  - Distinct measurement locations (e.g., `Inlet` and `Outlet`) at the identical timestamp are safely preserved.
- Explicit multiplier bounds validation: Multipliers must reside in $[-12, 12]$ before decimal exponentiation; out-of-bounds multipliers are rejected safely.
- Safe conflicting sample handling: Conflicting duplicate readings for an existing sample key are logged and the existing authoritative sample is preserved without corrupting data or throwing internal errors.
- Bounded, tenant-scoped pagination: Meter queries require tenant authorization and enforce strict pagination limits (default 50, maximum 100).

### 2. Precise Outbound Command Correlation and State Machine
- Database migration `V22__harden_meter_values_and_command_correlation.sql`:
  - Adds `remote_start_id` (integer) and `evse_id` (integer) to `station_commands` with indexed lookups.
- Strict remoteStartId validation: Non-null `remoteStartId` must be a positive integer ($> 0$), rejecting invalid strings or non-positive values with `IllegalArgumentException`.
- Exact correlation:
  - `RequestStartTransaction` correlates to `OBSERVED` strictly matching `station_id`, `action = 'RequestStartTransaction'`, and `remote_start_id`. Unrelated transaction events without `remoteStartId` never correlate.
  - `RequestStopTransaction` correlates to `OBSERVED` strictly matching `station_id`, `action = 'RequestStopTransaction'`, and `transaction_id`.
- Out-of-transaction dispatch: Initial `REQUESTED` status is committed to PostgreSQL *before* any WebSocket dispatch occurs. If an outer transaction is active, dispatch is registered via `TransactionSynchronization.afterCommit()`, preventing transmission on rollback.
- Zero credential leakage: Persisted command payloads mask the RFID token as `[REDACTED]`, while transmitting the raw token exclusively over the encrypted wire to the charger.
- Terminal state protection: Commands in `OBSERVED`, `TIMED_OUT`, `REJECTED`, or `UNCERTAIN` ignore late `CALL_RESULT` or `CALL_ERROR` frames. Duplicate responses are idempotent no-ops.
- Session disconnect: Pending commands transition to `UNCERTAIN` upon WebSocket disconnect.
- Concurrency-safe idempotency: Conflicting payloads (e.g., conflicting `evseId`, `remoteStartId`, or `transactionId`) throw `ConflictingCommandException`. Concurrent races are handled safely via unique DB constraints.

## Consequences

- Zero phantom command correlation across simultaneous or local charging sessions.
- Full protocol compliance with OCPP 2.0.1 `RequestStartTransactionRequest` and `TransactionEventRequest.transactionInfo`.
- Database rollback safety guaranteed: no unsaved commands can be dispatched to chargers.
- Zero credential leakage in database tables, logs, or traces.
- Multiplier and location precision guaranteed against memory exhaustion and collision bugs.
