package com.voltgrid.station.application;

import com.voltgrid.station.api.ocpp.OcppMessageProcessor;
import com.voltgrid.station.domain.CommandStatus;
import com.voltgrid.station.infrastructure.persistence.jpa.ChargingStationEntity;
import com.voltgrid.station.infrastructure.persistence.jpa.ChargingStationJpaRepository;
import com.voltgrid.station.infrastructure.persistence.jpa.StationCommandJpaRepository;
import com.voltgrid.station.support.PostgresTestConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Import(PostgresTestConfiguration.class)
class StationCommandLifecycleIntegrationTests {

    @Autowired
    private StationCommandService commandService;

    @Autowired
    private OcppMessageProcessor messageProcessor;

    @Autowired
    private ChargingStationJpaRepository stationRepository;

    @Autowired
    private StationCommandJpaRepository commandRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    private final ConcurrentHashMap<String, String> outboundCalls = new ConcurrentHashMap<>();

    @BeforeEach
    void setupCommandSender() {
        stationRepository.save(new ChargingStationEntity(
                "STATION-CMD-01", "CMD Station 1", com.voltgrid.station.domain.StationStatus.ONLINE
        ));
        stationRepository.save(new ChargingStationEntity(
                "STATION-CMD-02", "CMD Station 2", com.voltgrid.station.domain.StationStatus.ONLINE
        ));
        stationRepository.save(new ChargingStationEntity(
                "STATION-CMD-03", "CMD Station 3", com.voltgrid.station.domain.StationStatus.ONLINE
        ));

        commandService.setCommandSender(new OcppCommandSender() {
            @Override
            public boolean sendCall(String stationId, String messageId, String action, String payloadJson) {
                if ("STATION-DISCONNECTED".equals(stationId)) {
                    return false;
                }
                outboundCalls.put(messageId, action + ":" + payloadJson);
                return true;
            }

            @Override
            public boolean isStationConnected(String stationId) {
                return !"STATION-DISCONNECTED".equals(stationId);
            }
        });
    }

    @Test
    void shouldExecuteFullCommandLifecycleForRequestStartTransaction() {
        String stationId = "STATION-CMD-01";
        String idempotencyKey = "start-idemp-" + UUID.randomUUID();

        // 1. Request start transaction
        var command = commandService.requestStartTransaction(
                stationId,
                1,
                "TAG-RFID-99",
                "1001",
                idempotencyKey
        );

        assertThat(command.status()).isEqualTo(CommandStatus.PENDING);
        assertThat(outboundCalls).containsKey(command.messageId());

        // 2. Idempotent re-invocation returns existing command
        var reInvoked = commandService.requestStartTransaction(
                stationId,
                1,
                "TAG-RFID-99",
                "1001",
                idempotencyKey
        );
        assertThat(reInvoked.id()).isEqualTo(command.id());
        assertThat(reInvoked.messageId()).isEqualTo(command.messageId());

        // 3. Station responds with CALL_RESULT [3, "<messageId>", {"status": "Accepted"}]
        String callResultJson = """
                [3, "%s", {"status": "Accepted"}]
                """.formatted(command.messageId());

        String resultResponse = messageProcessor.process(stationId, callResultJson);
        assertThat(resultResponse).isNull();

        var acceptedCommand = commandService.getCommand(command.id()).orElseThrow();
        assertThat(acceptedCommand.status()).isEqualTo(CommandStatus.ACCEPTED);
        assertThat(acceptedCommand.observedAt()).isNull();

        // 4. Station subsequently sends TransactionEvent(eventType: Started) with remoteStartId
        String txId = "tx-cmd-started-" + UUID.randomUUID();
        String txStartedCall = """
                [2, "msg-tx-start-001", "TransactionEvent", {
                    "eventType": "Started",
                    "timestamp": "2026-11-27T17:40:00Z",
                    "triggerReason": "Authorized",
                    "seqNo": 0,
                    "transactionInfo": { "transactionId": "%s", "remoteStartId": 1001 },
                    "evse": { "id": 1, "connectorId": 1 }
                }]
                """.formatted(txId);

        String txResponse = messageProcessor.process(stationId, txStartedCall);
        assertThat(txResponse).contains("3", "msg-tx-start-001");

        // Command transitions to OBSERVED matching exact remoteStartId
        var observedCommand = commandService.getCommand(command.id()).orElseThrow();
        assertThat(observedCommand.status()).isEqualTo(CommandStatus.OBSERVED);
        assertThat(observedCommand.observedAt()).isNotNull();
        assertThat(observedCommand.transactionId()).isEqualTo(txId);
    }

    @Test
    void shouldRedactIdTokenInPersistedPayloadAndSendRawTokenOnWire() {
        String stationId = "STATION-CMD-01";
        String secretToken = "SECRET-RFID-TOKEN-777";
        var command = commandService.requestStartTransaction(
                stationId,
                1,
                secretToken,
                "2001",
                "idemp-redact-" + UUID.randomUUID()
        );

        // Database entity MUST redact the idToken
        var entity = commandRepository.findById(command.id()).orElseThrow();
        assertThat(entity.getPayload()).doesNotContain(secretToken);
        assertThat(entity.getPayload()).contains("[REDACTED]");

        // Outbound wire message MUST contain the actual idToken for the physical charger
        String sentWireCall = outboundCalls.get(command.messageId());
        assertThat(sentWireCall).isNotNull();
        assertThat(sentWireCall).contains(secretToken);
    }

    @Test
    void shouldRejectInvalidRemoteStartId() {
        String stationId = "STATION-CMD-01";

        assertThatThrownBy(() -> commandService.requestStartTransaction(
                stationId, 1, "TAG-1", "not-a-number", "idemp-" + UUID.randomUUID()
        )).isInstanceOf(IllegalArgumentException.class)
          .hasMessageContaining("Invalid remoteStartId");

        assertThatThrownBy(() -> commandService.requestStartTransaction(
                stationId, 1, "TAG-1", "-5", "idemp-" + UUID.randomUUID()
        )).isInstanceOf(IllegalArgumentException.class)
          .hasMessageContaining("remoteStartId must be positive");

        assertThatThrownBy(() -> commandService.requestStartTransaction(
                stationId, 1, "TAG-1", "0", "idemp-" + UUID.randomUUID()
        )).isInstanceOf(IllegalArgumentException.class)
          .hasMessageContaining("remoteStartId must be positive");
    }

    @Test
    void shouldCorrelateMultipleSimultaneousStartCommandsCorrectlyByRemoteStartId() {
        String stationId = "STATION-CMD-01";

        var cmd1 = commandService.requestStartTransaction(stationId, 1, "TAG-1", "3001", "idemp-sim-1");
        var cmd2 = commandService.requestStartTransaction(stationId, 2, "TAG-2", "3002", "idemp-sim-2");

        // Station accepts both
        messageProcessor.process(stationId, """
                [3, "%s", {"status": "Accepted"}]
                """.formatted(cmd1.messageId()));
        messageProcessor.process(stationId, """
                [3, "%s", {"status": "Accepted"}]
                """.formatted(cmd2.messageId()));

        assertThat(commandService.getCommand(cmd1.id()).orElseThrow().status()).isEqualTo(CommandStatus.ACCEPTED);
        assertThat(commandService.getCommand(cmd2.id()).orElseThrow().status()).isEqualTo(CommandStatus.ACCEPTED);

        // TransactionEvent Started arrives for cmd2 (remoteStartId = 3002)
        String txId2 = "tx-cmd2-" + UUID.randomUUID();
        messageProcessor.process(stationId, """
                [2, "msg-sim-start-2", "TransactionEvent", {
                    "eventType": "Started",
                    "timestamp": "2026-11-27T17:41:00Z",
                    "triggerReason": "Authorized",
                    "seqNo": 0,
                    "transactionInfo": { "transactionId": "%s", "remoteStartId": 3002 },
                    "evse": { "id": 2, "connectorId": 1 }
                }]
                """.formatted(txId2));

        // cmd2 MUST transition to OBSERVED; cmd1 MUST remain ACCEPTED
        assertThat(commandService.getCommand(cmd2.id()).orElseThrow().status()).isEqualTo(CommandStatus.OBSERVED);
        assertThat(commandService.getCommand(cmd2.id()).orElseThrow().transactionId()).isEqualTo(txId2);

        assertThat(commandService.getCommand(cmd1.id()).orElseThrow().status()).isEqualTo(CommandStatus.ACCEPTED);
        assertThat(commandService.getCommand(cmd1.id()).orElseThrow().observedAt()).isNull();
    }

    @Test
    void shouldNotCorrelateUnrelatedTransactionEventWithStartCommand() {
        String stationId = "STATION-CMD-01";
        var cmd = commandService.requestStartTransaction(stationId, 1, "TAG-1", "4001", "idemp-unrelated");

        messageProcessor.process(stationId, """
                [3, "%s", {"status": "Accepted"}]
                """.formatted(cmd.messageId()));

        // An unrelated local transaction event starts (no remoteStartId)
        messageProcessor.process(stationId, """
                [2, "msg-unrelated-tx", "TransactionEvent", {
                    "eventType": "Started",
                    "timestamp": "2026-11-27T17:42:00Z",
                    "triggerReason": "Authorized",
                    "seqNo": 0,
                    "transactionInfo": { "transactionId": "tx-local-card-tap" },
                    "evse": { "id": 1, "connectorId": 1 }
                }]
                """);

        // The remote start command MUST NOT correlate with the local tap!
        var cmdAfter = commandService.getCommand(cmd.id()).orElseThrow();
        assertThat(cmdAfter.status()).isEqualTo(CommandStatus.ACCEPTED);
        assertThat(cmdAfter.observedAt()).isNull();
    }

    @Test
    void shouldExecuteFullCommandLifecycleForRequestStopTransaction() {
        String stationId = "STATION-CMD-02";
        String txId = "tx-cmd-stop-" + UUID.randomUUID();

        // 1. First start transaction
        messageProcessor.process(stationId, """
                [2, "msg-tx-start-002", "TransactionEvent", {
                    "eventType": "Started",
                    "timestamp": "2026-11-27T17:40:00Z",
                    "triggerReason": "Authorized",
                    "seqNo": 0,
                    "transactionInfo": { "transactionId": "%s" },
                    "evse": { "id": 1, "connectorId": 1 }
                }]
                """.formatted(txId));

        // 2. Request stop transaction
        var stopCommand = commandService.requestStopTransaction(
                stationId,
                txId,
                "stop-idemp-" + UUID.randomUUID()
        );
        assertThat(stopCommand.status()).isEqualTo(CommandStatus.PENDING);

        // 3. Station responds Accepted
        messageProcessor.process(stationId, """
                [3, "%s", {"status": "Accepted"}]
                """.formatted(stopCommand.messageId()));

        var acceptedStop = commandService.getCommand(stopCommand.id()).orElseThrow();
        assertThat(acceptedStop.status()).isEqualTo(CommandStatus.ACCEPTED);

        // 4. Station sends TransactionEvent(eventType: Ended)
        messageProcessor.process(stationId, """
                [2, "msg-tx-end-002", "TransactionEvent", {
                    "eventType": "Ended",
                    "timestamp": "2026-11-27T17:45:00Z",
                    "triggerReason": "RemoteStop",
                    "seqNo": 1,
                    "transactionInfo": { "transactionId": "%s" }
                }]
                """.formatted(txId));

        var observedStop = commandService.getCommand(stopCommand.id()).orElseThrow();
        assertThat(observedStop.status()).isEqualTo(CommandStatus.OBSERVED);
        assertThat(observedStop.observedAt()).isNotNull();
    }

    @Test
    void shouldCorrelateStopCommandStrictlyByTransactionId() {
        String stationId = "STATION-CMD-02";
        String txA = "tx-A-" + UUID.randomUUID();
        String txB = "tx-B-" + UUID.randomUUID();

        // Start both transactions so transaction service tracks them
        messageProcessor.process(stationId, """
                [2, "msg-tx-start-a", "TransactionEvent", {
                    "eventType": "Started",
                    "timestamp": "2026-11-27T17:40:00Z",
                    "triggerReason": "Authorized",
                    "seqNo": 0,
                    "transactionInfo": { "transactionId": "%s" },
                    "evse": { "id": 1, "connectorId": 1 }
                }]
                """.formatted(txA));

        messageProcessor.process(stationId, """
                [2, "msg-tx-start-b", "TransactionEvent", {
                    "eventType": "Started",
                    "timestamp": "2026-11-27T17:41:00Z",
                    "triggerReason": "Authorized",
                    "seqNo": 0,
                    "transactionInfo": { "transactionId": "%s" },
                    "evse": { "id": 2, "connectorId": 1 }
                }]
                """.formatted(txB));

        var stopA = commandService.requestStopTransaction(stationId, txA, "idemp-stop-A");
        var stopB = commandService.requestStopTransaction(stationId, txB, "idemp-stop-B");

        messageProcessor.process(stationId, """
                [3, "%s", {"status": "Accepted"}]
                """.formatted(stopA.messageId()));
        messageProcessor.process(stationId, """
                [3, "%s", {"status": "Accepted"}]
                """.formatted(stopB.messageId()));

        // Ended event arrives for txB only
        messageProcessor.process(stationId, """
                [2, "msg-tx-end-b", "TransactionEvent", {
                    "eventType": "Ended",
                    "timestamp": "2026-11-27T17:46:00Z",
                    "triggerReason": "RemoteStop",
                    "seqNo": 1,
                    "transactionInfo": { "transactionId": "%s" }
                }]
                """.formatted(txB));

        assertThat(commandService.getCommand(stopB.id()).orElseThrow().status()).isEqualTo(CommandStatus.OBSERVED);
        assertThat(commandService.getCommand(stopA.id()).orElseThrow().status()).isEqualTo(CommandStatus.ACCEPTED);
    }

    @Test
    void shouldNotOverwriteTerminalOrObservedStatesOnLateResponseOrError() {
        String stationId = "STATION-CMD-01";
        var cmd = commandService.requestStartTransaction(stationId, 1, "TAG-1", "5001", "idemp-terminal");

        // Accept command
        messageProcessor.process(stationId, """
                [3, "%s", {"status": "Accepted"}]
                """.formatted(cmd.messageId()));

        // Observe command via TransactionEvent
        messageProcessor.process(stationId, """
                [2, "msg-terminal-observed", "TransactionEvent", {
                    "eventType": "Started",
                    "timestamp": "2026-11-27T17:47:00Z",
                    "triggerReason": "Authorized",
                    "seqNo": 0,
                    "transactionInfo": { "transactionId": "tx-term", "remoteStartId": 5001 },
                    "evse": { "id": 1, "connectorId": 1 }
                }]
                """);

        assertThat(commandService.getCommand(cmd.id()).orElseThrow().status()).isEqualTo(CommandStatus.OBSERVED);

        // A late CALL_ERROR arrives for this command: MUST NOT overwrite OBSERVED
        messageProcessor.process(stationId, """
                [4, "%s", "InternalError", "Late error after start", {}]
                """.formatted(cmd.messageId()));

        assertThat(commandService.getCommand(cmd.id()).orElseThrow().status()).isEqualTo(CommandStatus.OBSERVED);

        // A late CALL_RESULT arrives: MUST NOT overwrite OBSERVED
        messageProcessor.process(stationId, """
                [3, "%s", {"status": "Rejected"}]
                """.formatted(cmd.messageId()));

        assertThat(commandService.getCommand(cmd.id()).orElseThrow().status()).isEqualTo(CommandStatus.OBSERVED);
    }

    @Test
    void shouldHandleDuplicateResponsesIdempotently() {
        String stationId = "STATION-CMD-01";
        var cmd = commandService.requestStartTransaction(stationId, 1, "TAG-1", "6001", "idemp-dup-resp");

        messageProcessor.process(stationId, """
                [3, "%s", {"status": "Accepted"}]
                """.formatted(cmd.messageId()));
        assertThat(commandService.getCommand(cmd.id()).orElseThrow().status()).isEqualTo(CommandStatus.ACCEPTED);

        // Duplicate response arrives
        messageProcessor.process(stationId, """
                [3, "%s", {"status": "Accepted"}]
                """.formatted(cmd.messageId()));
        assertThat(commandService.getCommand(cmd.id()).orElseThrow().status()).isEqualTo(CommandStatus.ACCEPTED);
    }

    @Test
    void shouldTransitionPendingCommandsToUncertainOnStationDisconnect() {
        String stationId = "STATION-CMD-03";
        var cmd = commandService.requestStartTransaction(stationId, 1, "TAG-1", "7001", "idemp-disc-trans");
        assertThat(cmd.status()).isEqualTo(CommandStatus.PENDING);

        // Station abruptly disconnects before replying
        commandService.handleStationDisconnect(stationId);

        var updated = commandService.getCommand(cmd.id()).orElseThrow();
        assertThat(updated.status()).isEqualTo(CommandStatus.UNCERTAIN);
        assertThat(updated.responsePayload()).contains("Uncertain");

        // A late response after disconnect MUST NOT overwrite UNCERTAIN
        messageProcessor.process(stationId, """
                [3, "%s", {"status": "Accepted"}]
                """.formatted(cmd.messageId()));
        assertThat(commandService.getCommand(cmd.id()).orElseThrow().status()).isEqualTo(CommandStatus.UNCERTAIN);
    }

    @Test
    void shouldDetectConflictingIdempotencyKeyPayloads() {
        String stationId = "STATION-CMD-01";
        String key = "idemp-conflict-" + UUID.randomUUID();

        commandService.requestStartTransaction(stationId, 1, "TAG-1", "8001", key);

        // Conflicting evseId
        assertThatThrownBy(() -> commandService.requestStartTransaction(stationId, 2, "TAG-1", "8001", key))
                .isInstanceOf(ConflictingCommandException.class)
                .hasMessageContaining("Conflicting evseId");

        // Conflicting remoteStartId
        assertThatThrownBy(() -> commandService.requestStartTransaction(stationId, 1, "TAG-1", "8002", key))
                .isInstanceOf(ConflictingCommandException.class)
                .hasMessageContaining("Conflicting remoteStartId");

        String stopKey = "idemp-stop-conflict-" + UUID.randomUUID();
        commandService.requestStopTransaction(stationId, "tx-999", stopKey);

        // Conflicting transactionId
        assertThatThrownBy(() -> commandService.requestStopTransaction(stationId, "tx-888", stopKey))
                .isInstanceOf(ConflictingCommandException.class)
                .hasMessageContaining("Conflicting transactionId");
    }

    @Test
    void shouldNotDispatchWebSocketCallOnTransactionRollback() {
        String stationId = "STATION-CMD-01";
        TransactionTemplate template = new TransactionTemplate(transactionManager);

        String idempKey = "rollback-idemp-" + UUID.randomUUID();

        try {
            template.execute(status -> {
                commandService.requestStartTransaction(stationId, 1, "TAG-RB", "9001", idempKey);
                // Deliberately roll back transaction
                throw new RuntimeException("Simulated transaction rollback");
            });
        } catch (RuntimeException ignored) {
        }

        // Verify that NO message was dispatched to the charger over WebSocket!
        var matchingDispatched = outboundCalls.values().stream()
                .filter(call -> call.contains("9001") && call.contains("TAG-RB"))
                .findFirst();

        assertThat(matchingDispatched).isEmpty();

        // Verify entity was rolled back and does not exist in DB
        var existing = commandRepository.findByStationIdAndIdempotencyKey(stationId, idempKey);
        assertThat(existing).isEmpty();
    }

    @Test
    void shouldRejectCommandWhenStationIsDisconnected() {
        var command = commandService.requestStartTransaction(
                "STATION-DISCONNECTED",
                1,
                "TAG-RFID-99",
                "1002",
                "disc-idemp-" + UUID.randomUUID()
        );

        assertThat(command.status()).isEqualTo(CommandStatus.REJECTED);
        assertThat(command.responsePayload()).contains("Rejected");
    }

    @Test
    void shouldTransitionToRejectedOnCallError() {
        String stationId = "STATION-CMD-03";
        var command = commandService.requestStartTransaction(
                stationId,
                1,
                "TAG-RFID-99",
                "1003",
                "err-idemp-" + UUID.randomUUID()
        );

        assertThat(command.status()).isEqualTo(CommandStatus.PENDING);

        messageProcessor.process(stationId, """
                [4, "%s", "NotSupported", "Feature disabled", {}]
                """.formatted(command.messageId()));

        var updatedCommand = commandService.getCommand(command.id()).orElseThrow();
        assertThat(updatedCommand.status()).isEqualTo(CommandStatus.REJECTED);
        assertThat(updatedCommand.responsePayload()).contains("NotSupported");
    }

    @Test
    void keepsResponseReceivedBeforeDispatchReturns() {
        commandService.setCommandSender(new OcppCommandSender() {
            @Override
            public boolean sendCall(String stationId, String messageId, String action, String payloadJson) {
                commandService.handleCommandResponse(stationId, messageId, """
                        {"status":"Accepted"}
                        """);
                return true;
            }

            @Override
            public boolean isStationConnected(String stationId) {
                return true;
            }
        });

        var start = commandService.requestStartTransaction(
                "STATION-CMD-01", 1, "TAG-SYNTHETIC", "19001", UUID.randomUUID().toString());
        var stop = commandService.requestStopTransaction(
                "STATION-CMD-01", "tx-immediate-response", UUID.randomUUID().toString());

        assertThat(start.status()).isEqualTo(CommandStatus.ACCEPTED);
        assertThat(stop.status()).isEqualTo(CommandStatus.ACCEPTED);
    }

    @Test
    void persistsDispatchStateAfterOuterTransactionCommits() {
        var transaction = new TransactionTemplate(transactionManager);
        var start = transaction.execute(status -> commandService.requestStartTransaction(
                "STATION-CMD-01", 1, "TAG-SYNTHETIC", "19002", UUID.randomUUID().toString()));
        var stop = transaction.execute(status -> commandService.requestStopTransaction(
                "STATION-CMD-01", "tx-outer-commit", UUID.randomUUID().toString()));

        assertThat(outboundCalls).containsKeys(start.messageId(), stop.messageId());
        assertThat(commandService.getCommand(start.id()).orElseThrow().status()).isEqualTo(CommandStatus.PENDING);
        assertThat(commandService.getCommand(stop.id()).orElseThrow().status()).isEqualTo(CommandStatus.PENDING);
    }
}
