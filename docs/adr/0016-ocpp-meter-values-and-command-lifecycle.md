# 0016. OCPP 2.0.1 Standalone MeterValues Ingestion and Outbound Command Lifecycle

## Status

Approved

## Context

VoltGrid operates commercial EV charging stations adhering to OCPP 2.0.1. Under the VG-200 architecture audit, three core protocol and operational gaps were identified (GAP-001, GAP-002, GAP-003):

1. **GAP-001 (Standalone MeterValues Ingestion)**: In OCPP 2.0.1, charging stations transmit `MeterValues` messages for periodic telemetry, grid monitoring, and idle EVSE status independently of active charging transactions. Prior implementations only ingested meter readings if embedded within `TransactionEvent(eventType = "Updated")`, resulting in discarded off-session telemetry and lack of EVSE/connector provenance.
2. **GAP-002 (Outbound Command State Machine)**: CSMS commands (e.g. `RequestStartTransaction`, `RequestStopTransaction`) lacked a durable lifecycle. Without CALL correlation (`messageId`), requests were fire-and-forget without deterministic timeout handling, idempotency deduplication, or error classification.
3. **GAP-003 (Premature Charging Commencement Assumption)**: In physical charging operations, a charging station's `CALL_RESULT` response containing `status: "Accepted"` merely indicates that the charger has accepted the command instruction; it does *not* mean physical power flow or charging has begun. Treating `Accepted` as an active transaction leads to false billing, connector status corruption, and customer disputes.

## Decision

We establish a comprehensive OCPP 2.0.1 MeterValues ingestion and outbound command lifecycle framework:

### 1. Standalone Station Meter Values Schema & Ingestion
- Created `station_meter_values` table via Flyway migration `V21__create_station_meter_values_and_command_lifecycle.sql`.
- Records station, EVSE (`evse_id >= 0`), and optional connector/transaction provenance.
- Preserves raw decimal values, reported units, and multiplier exponents ($raw \times 10^{multiplier}$), while storing normalized decimal values in canonical base units (e.g., kWh normalized to Wh).
- Handles full RFC3339 timezone offsets (e.g., `+05:30`, `Z`, `-04:00`) to UTC `Instant`.
- Implements idempotent deduplication via unique constraint `uq_station_meter_values_sample` over `(station_id, evse_id, sampled_at, measurand, phase, context)`, preventing duplicate rows on network retries or late-arriving frames.

### 2. Outbound CALL Correlation and Command Lifecycle
- Created `station_commands` table tracking every outbound CALL message by `station_id` and unique `message_id`.
- Established explicit lifecycle statuses:
  - `REQUESTED`: Command recorded prior to transmission.
  - `PENDING`: Command dispatched over active WebSocket session.
  - `ACCEPTED`: Station confirmed receipt with `[3, "<messageId>", {"status": "Accepted"}]`.
  - `REJECTED`: Station rejected command (`{"status": "Rejected"}`), returned `CALL_ERROR` (`[4, ...]`), or station was disconnected.
  - `TIMED_OUT`: Command expired before response received.
  - `UNCERTAIN`: Session terminated while command was pending.
  - `OBSERVED`: Command verified by subsequent physical evidence (`TransactionEvent`).
- Idempotency key deduplication: duplicate command requests with identical idempotency keys return the existing record without re-transmitting to the charger.

### 3. Separation of Command Acceptance from Physical Charging
- Explicit safety invariant: A command in `ACCEPTED` state never starts billing or triggers power delivery records.
- Transition to `OBSERVED` occurs exclusively when corroborated by an incoming `TransactionEvent(eventType: "Started")` or `TransactionEvent(eventType: "Ended")`.

## Consequences

- Standalone grid and EVSE telemetry is reliably captured and indexed.
- Full traceability for remote start/stop operations with verifiable audit trail.
- Prevents phantom charging sessions and billing disputes from non-starting stations.
- Bounded input validation eliminates format violation vulnerabilities.
