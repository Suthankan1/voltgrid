# VG-208 Remediation Verification Dossier: OCPP 2.0.1 Command & Meter Lifecycle

- **Milestone**: [Issue #10: [VG-208][P0] OCPP 2.0.1 core charging operations and metering](https://github.com/Suthankan1/voltgrid/issues/10)
- **Branch**: `remediation/vg-208-command-and-meter-lifecycle`
- **Scope**: Remediation of 11 confirmed defects across `StationCommandService`, `StationMeterValueService`, migrations, entities, and OCPP message processing.

---

## 1. Confirmed Defects & Implementation Details

| Defect ID | Defect Description | Remediation Details | Verification Regression Test |
|---|---|---|---|
| **DEF-001** | Start command correlation selected latest accepted start command instead of matching `remoteStartId` | Added `remote_start_id` to `station_commands` (V22 migration). Extracted `remoteStartId` from `TransactionEvent.transactionInfo`. Correlates strictly by `stationId`, action, `remoteStartId`, and `status = ACCEPTED`. | `shouldCorrelateMultipleSimultaneousStartCommandsCorrectlyByRemoteStartId`, `shouldNotCorrelateUnrelatedTransactionEventWithStartCommand` |
| **DEF-002** | Stop command correlation selected latest accepted stop command instead of matching `transactionId` | Correlates strictly by `stationId`, `action = 'RequestStopTransaction'`, `transactionId`, and `status = ACCEPTED`. | `shouldCorrelateStopCommandStrictlyByTransactionId` |
| **DEF-003** | Commands were dispatched over WebSocket inside uncommitted database transaction | Persisted `REQUESTED` record is committed before WebSocket dispatch occurs. In transactional contexts, dispatch is deferred via `TransactionSynchronization.afterCommit()`. On transaction rollback, no wire message is sent. | `shouldNotDispatchWebSocketCallOnTransactionRollback` |
| **DEF-004** | Raw RFID `idToken` persisted in plain text in database | Masked `idToken` as `[REDACTED]` in persisted `station_commands.payload`, while sending raw token on wire to physical charger. | `shouldRedactIdTokenInPersistedPayloadAndSendRawTokenOnWire` |
| **DEF-005** | Response handling overwrote terminal or observed command states | Added terminal/observed state guards in `handleCommandResponse` and `handleCommandError`. Late responses or errors for commands in `OBSERVED`, `TIMED_OUT`, `REJECTED`, or `UNCERTAIN` are rejected. | `shouldNotOverwriteTerminalOrObservedStatesOnLateResponseOrError`, `shouldHandleDuplicateResponsesIdempotently` |
| **DEF-006** | Incomplete disconnect, timeout, and uncertain delivery state machine | Added `handleStationDisconnect` in `StationCommandService` hooked into `OcppWebSocketHandler.afterConnectionClosed`. Transitions `PENDING` commands to `UNCERTAIN`. `checkTimeouts` transitions expired commands to `TIMED_OUT`. | `shouldTransitionPendingCommandsToUncertainOnStationDisconnect` |
| **DEF-007** | Invalid `remoteStartId` silently fell back to `1` | Strict integer validation requiring positive integer ($> 0$), throwing `IllegalArgumentException` on non-numeric or non-positive values. | `shouldRejectInvalidRemoteStartId` |
| **DEF-008** | Idempotency lacked concurrency protection and conflict detection | Added conflict checks against `evseId`, `remoteStartId`, and `transactionId`, throwing `ConflictingCommandException`. DB unique constraint `uq_station_commands_idempotency` guards against concurrent races. | `shouldDetectConflictingIdempotencyKeyPayloads` |
| **DEF-009** | Multipliers lacked bounded validation before decimal exponentiation | Bounded multiplier validation strictly enforced to $[-12, 12]$ before computing `BigDecimal.TEN.pow(multiplier)`. Out-of-bounds multipliers are safely rejected. | `shouldRejectExcessiveMultipliers` |
| **DEF-010** | Meter deduplication omitted location and lacked safe conflict handling | Recreated unique index `uq_station_meter_values_sample` with `COALESCE(location, 'NONE')`. Distinct locations (e.g. `Inlet` vs `Outlet`) are preserved. Conflicting duplicate samples retain authoritative existing data safely. | `shouldPreserveDistinctMeasurementLocationsAtSameTimestamp`, `shouldSafelyHandleConflictingDuplicateSamplesWithoutCorruptingData` |
| **DEF-011** | Meter and command retrieval lacked bounded, tenant-scoped pagination | Implemented `getMeterValues` and `getCommands` with `organizationId` authorization verification via `ChargingStationJpaRepository` and bounded pagination ($1 \le size \le 100$, default 50). | `shouldProvideBoundedTenantScopedPagination` |

---

## 2. Test Execution Evidence

All 21 integration tests in `StationCommandLifecycleIntegrationTests` and `StationMeterValueIntegrationTests` pass against real PostgreSQL:

```
[INFO] Running com.voltgrid.station.application.StationCommandLifecycleIntegrationTests
[INFO] Tests run: 14, Failures: 0, Errors: 0, Skipped: 0 -- in com.voltgrid.station.application.StationCommandLifecycleIntegrationTests
[INFO] Running com.voltgrid.station.application.StationMeterValueIntegrationTests
[INFO] Tests run: 7, Failures: 0, Errors: 0, Skipped: 0 -- in com.voltgrid.station.application.StationMeterValueIntegrationTests
[INFO] 
[INFO] Results:
[INFO] Tests run: 21, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

## Dispatch result after commit

Two additional PostgreSQL regressions reproduced a remaining issue in PR #93. An immediate CALL_RESULT left a command pending after the dispatch path overwrote its accepted status. A command sent after an enclosing transaction committed stayed requested because the dispatch result used the already-committed transaction context. Both cases cover start and stop with an in-process sender.

The dispatch result now uses a new transaction and a conditional update limited to rows still in REQUESTED. An immediate response therefore retains its accepted state. The existing rollback regression still verifies that a rolled-back request emits no CALL. The combined command and meter suites passed 23 tests, and full offline Station Maven verification passed 307 tests. All sender assertions used local fixtures.

The remainder of #10 includes session ownership and timeout races, EVSE and transaction identity checks, RFID-aware idempotency and safe backfill, simulator acceptance, and approved physical charger validation.
