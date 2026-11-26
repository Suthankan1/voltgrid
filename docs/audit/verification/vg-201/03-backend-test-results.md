# 03 — Backend Test Results

> **Milestone**: VG-201  
> **Verification Branch**: `verification/vg-201-core-hardening`  
> **Environment**: macOS Darwin arm64 · Java OpenJDK 25.0.4.1 · Apache Maven 3.15.0 / Surefire 3.5.6 · Docker 29.9.3 (Testcontainers)  
> **Execution Date**: 2026-11-26  

---

## 1. Test Execution Summary

All backend services were executed using their documented Maven wrappers with full test verification (`verify` and `test` goals). No tests were skipped.

| Service | Working Directory | Command | Total Tests | Passed | Failed | Skipped | Duration |
|---|---|---|---|---|---|---|---|
| **authorization-service** | `services/authorization-service` | `./mvnw clean verify` | 20 | 20 | 0 | 0 | 11.276 s |
| **operations-service** | `services/operations-service` | `./mvnw clean verify` | 33 | 33 | 0 | 0 | 01:10 min |
| **station-service** | `services/station-service` | `./mvnw clean verify` | 163 | 163 | 0 | 0 | 28.247 s |
| **integration-tests/authorization-flow** | `integration-tests/authorization-flow` | `mvn clean test` | 4 | 4 | 0 | 0 | 31.626 s |
| **Total Backend** | — | — | **220** | **220** | **0** | **0** | **~2.2 min** |

---

## 2. Service-by-Service Test Execution Details

### A. Authorization Service (`services/authorization-service`)
- **Command**: `./mvnw clean verify`
- **Build Status**: `BUILD SUCCESS` (Total time: 11.276 s)
- **Suite Breakdown**:
  - `AuthorizationServiceApplicationTests`: 1 run, 1 passed
  - `TokenFingerprintServiceTests`: 5 run, 5 passed
  - `AuthorizationDecisionServiceTests`: 6 run, 6 passed
  - `AuthorizationContractTests`: 1 run, 1 passed
  - `GrpcAuthorizationServiceTests`: 6 run, 6 passed
  - `AuthorizationTokenRepositoryIntegrationTests`: 1 run, 1 passed (Testcontainers PostgreSQL 18.6)
  - `AuthorizationGrpcIntegrationTests`: 6 run, 6 passed (gRPC channel communication)
- **Results**: 20 tests executed, 20 passed, 0 failures, 0 errors, 0 skipped.

---

### B. Operations Service (`services/operations-service`)
- **Command**: `./mvnw clean verify`
- **Build Status**: `BUILD SUCCESS` (Total time: 01:10 min)
- **Suite Breakdown**:
  - `OperationsHealthProbeE2EIntegrationTests`: 1 run, 1 passed
  - `StationStatusProjectionEntityTests`: 4 run (3 original + 1 new), 4 passed
    - *Includes new test*: `shouldDemonstrateEqualTimestampArrivalOrderSensitivity`
  - `StationStatusChangedEventParserTests`: 6 run, 6 passed
  - `StationStatusGraphQlControllerTests`: 5 run, 5 passed
  - `StationStatusGraphQlE2EIntegrationTests`: 3 run, 3 passed
  - `StationStatusPaginationE2EIntegrationTests`: 3 run, 3 passed
  - `StationStatusFilteringE2EIntegrationTests`: 4 run, 4 passed
  - `StationStatusGraphQlErrorE2EIntegrationTests`: 3 run, 3 passed
  - `ProjectingStationStatusChangedHandlerIntegrationTests`: 5 run, 5 passed
  - `ProjectingStationStatusChangedHandlerConcurrencyIntegrationTests`: 1 run, 1 passed
  - `StationStatusChangedConsumerIntegrationTests`: 1 run, 1 passed
  - `StationStatusConsumerConfigurationIntegrationTests`: 2 run, 2 passed
  - `StationStatusProjectionE2EIntegrationTests`: 1 run, 1 passed
  - `StationStatusFailureE2EIntegrationTests`: 1 run, 1 passed
  - `StationStatusDeadLetterRecoveryE2EIntegrationTests`: 1 run, 1 passed
  - `StationStatusProjectionRepositoryIntegrationTests`: 1 run, 1 passed
  - `OperationsServiceApplicationTests`: 1 run, 1 passed
- **Results**: 33 tests executed, 33 passed, 0 failures, 0 errors, 0 skipped.

---

### C. Station Service (`services/station-service`)
- **Command**: `./mvnw clean verify`
- **Build Status**: `BUILD SUCCESS` (Total time: 28.247 s)
- **Key Suites & Regression Tests**:
  - `OperatorApiSecurityFilterTests`: 3 run, 3 passed
  - `StationTransactionGraphQlControllerTests`: 14 run, 14 passed
  - `StationGraphQlControllerTests`: 8 run, 8 passed
  - `StationTransactionGlobalQueryTests`: 5 run, 5 passed
  - `OcppMessageProcessorTests`: 26 run (22 original + 4 new), 26 passed
    - *Includes new tests*:
      - `shouldRejectTransactionEventWithNegativeSeqNo`
      - `shouldAcceptTransactionEventWithMaxAllowedSeqNo` (1,000,000)
      - `shouldRejectTransactionEventWithSeqNoExceedingLimit` (1,000,001)
      - `shouldRejectTransactionEventWithMaxIntegerSeqNo` (2,147,483,647)
  - `OcppHandshakeInterceptorAuthTests`: 5 run, 5 passed
  - `OcppHandshakeInterceptorTests`: 6 run, 6 passed
  - `OcppWebSocketHandlerTests`: 5 run (2 original + 3 new), 5 passed
    - *Includes new tests*:
      - `shouldHandleRapidReconnectLoopsAcrossMultipleSessions`
      - `shouldIgnoreClosedSessionWithoutStationId`
  - `StationServiceApplicationTests`: 1 run, 1 passed
  - `TransactionCompletenessBatchTests`: 2 run, 2 passed
  - `TransactionCompletenessServiceTests`: 12 run (8 original + 4 new), 12 passed
    - *Includes new tests*:
      - `shouldHandleDuplicateSequenceNumbersInReceipts`
      - `shouldHandleOutOfOrderReceipts`
      - `shouldHandleSparseSequenceNumbersWithinLimit`
      - `shouldReturnEmptyMissingSequencesWhenRangeExceedsSafeLimit`
  - `StationLivenessServiceTests`: 4 run, 4 passed (stale detection + outbox verification)
  - `StationConnectivityServiceTests`: 6 run (5 original + 1 new), 6 passed
    - *Includes new test*:
      - `shouldTransitionOfflineStationToOnlineOnRecordActivityAndEmitOutboxEvent`
  - `StationConnectorStatusServiceTests`: 4 run (2 original + 2 new), 4 passed
    - *Includes new tests*:
      - `shouldAllowConnectorStatusUpdateWhenTimestampIsEqualToExisting`
      - `shouldIsolateStatusUpdatesAcrossDistinctConnectors`
  - `StationRegistrationServiceTests`: 4 run (2 original + 2 new), 4 passed
    - *Includes new tests*:
      - `shouldRegisterStationWithMaximumLengthIdentifier` (255 chars)
      - `shouldPropagateExceptionWhenDatabaseWriterFails`
  - `NetworkTransactionPaginationTests`: 10 run, 10 passed
  - `StationTransactionServiceTests`: 9 run, 9 passed
  - `StationConnectivityOutboxIntegrationTests`: 2 run, 2 passed
  - `StationConnectivityOfflineOutboxIntegrationTests`: 1 run, 1 passed
  - `StationTransactionConcurrencyIntegrationTests`: 1 run, 1 passed
  - `TransactionIntegrityViewIntegrationTests`: 4 run, 4 passed
  - `OutboxRelayIntegrationTests`: 4 run, 4 passed
  - `OutboxRelayServiceTests`: 7 run, 7 passed
  - `OutboxClaimConcurrencyIntegrationTests`: 1 run, 1 passed
  - `OutboxEventEntityTests`: 2 run, 2 passed
  - `StationStatusOutboxWriterTests`: 3 run, 3 passed
- **Results**: 163 tests executed, 163 passed, 0 failures, 0 errors, 0 skipped.

---

### D. Authorization Flow Integration Tests (`integration-tests/authorization-flow`)
- **Command**: `mvn clean test`
- **Build Status**: `BUILD SUCCESS` (Total time: 31.626 s)
- **Suite Breakdown**:
  - `AuthorizationFlowHarnessTests`: 1 run, 1 passed
  - `AuthorizationFlowE2ETests`: 1 run, 1 passed (full gRPC handshake between station-service and authorization-service)
  - `AuthorizationServiceProcessTests`: 1 run, 1 passed
  - `StationServiceProcessTests`: 1 run, 1 passed
- **Results**: 4 tests executed, 4 passed, 0 failures, 0 errors, 0 skipped.

---

## 3. Newly Added Regression Tests Summary

The following 16 regression tests were authored directly during this assignment to eliminate historical test blindspots:

1. `TransactionCompletenessServiceTests.shouldHandleDuplicateSequenceNumbersInReceipts`
2. `TransactionCompletenessServiceTests.shouldHandleOutOfOrderReceipts`
3. `TransactionCompletenessServiceTests.shouldHandleSparseSequenceNumbersWithinLimit`
4. `TransactionCompletenessServiceTests.shouldReturnEmptyMissingSequencesWhenRangeExceedsSafeLimit`
5. `OcppMessageProcessorTests.shouldRejectTransactionEventWithNegativeSeqNo`
6. `OcppMessageProcessorTests.shouldAcceptTransactionEventWithMaxAllowedSeqNo`
7. `OcppMessageProcessorTests.shouldRejectTransactionEventWithSeqNoExceedingLimit`
8. `OcppMessageProcessorTests.shouldRejectTransactionEventWithMaxIntegerSeqNo`
9. `OcppWebSocketHandlerTests.shouldHandleRapidReconnectLoopsAcrossMultipleSessions`
10. `OcppWebSocketHandlerTests.shouldIgnoreClosedSessionWithoutStationId`
11. `StationConnectivityServiceTests.shouldTransitionOfflineStationToOnlineOnRecordActivityAndEmitOutboxEvent`
12. `StationConnectorStatusServiceTests.shouldAllowConnectorStatusUpdateWhenTimestampIsEqualToExisting`
13. `StationConnectorStatusServiceTests.shouldIsolateStatusUpdatesAcrossDistinctConnectors`
14. `StationRegistrationServiceTests.shouldRegisterStationWithMaximumLengthIdentifier`
15. `StationRegistrationServiceTests.shouldPropagateExceptionWhenDatabaseWriterFails`
16. `StationStatusProjectionEntityTests.shouldDemonstrateEqualTimestampArrivalOrderSensitivity`
