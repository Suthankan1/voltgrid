package com.voltgrid.station.application;

import com.voltgrid.station.api.ocpp.OcppMessageProcessor;
import com.voltgrid.station.domain.CommandStatus;
import com.voltgrid.station.support.PostgresTestConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Import(PostgresTestConfiguration.class)
class StationCommandLifecycleIntegrationTests {

    @Autowired
    private StationCommandService commandService;

    @Autowired
    private OcppMessageProcessor messageProcessor;

    @Autowired
    private com.voltgrid.station.infrastructure.persistence.jpa.ChargingStationJpaRepository stationRepository;

    private final ConcurrentHashMap<String, String> outboundCalls = new ConcurrentHashMap<>();

    @BeforeEach
    void setupCommandSender() {
        stationRepository.save(new com.voltgrid.station.infrastructure.persistence.jpa.ChargingStationEntity(
                "STATION-CMD-01", "CMD Station 1", com.voltgrid.station.domain.StationStatus.ONLINE
        ));
        stationRepository.save(new com.voltgrid.station.infrastructure.persistence.jpa.ChargingStationEntity(
                "STATION-CMD-02", "CMD Station 2", com.voltgrid.station.domain.StationStatus.ONLINE
        ));
        stationRepository.save(new com.voltgrid.station.infrastructure.persistence.jpa.ChargingStationEntity(
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
        // Server does not reply to a station CALL_RESULT
        assertThat(resultResponse).isNull();

        var acceptedCommand = commandService.getCommand(command.id()).orElseThrow();
        assertThat(acceptedCommand.status()).isEqualTo(CommandStatus.ACCEPTED);
        // Safety gate: Accepted CALL_RESULT does NOT imply actual charging yet
        assertThat(acceptedCommand.observedAt()).isNull();

        // 4. Station subsequently sends TransactionEvent(eventType: Started)
        String txId = "tx-cmd-started-" + UUID.randomUUID();
        String txStartedCall = """
                [2, "msg-tx-start-001", "TransactionEvent", {
                    "eventType": "Started",
                    "timestamp": "2026-11-27T17:40:00Z",
                    "triggerReason": "Authorized",
                    "seqNo": 0,
                    "transactionInfo": { "transactionId": "%s" },
                    "evse": { "id": 1, "connectorId": 1 }
                }]
                """.formatted(txId);

        String txResponse = messageProcessor.process(stationId, txStartedCall);
        assertThat(txResponse).contains("3", "msg-tx-start-001");

        // Command lifecycle transitions to OBSERVED once actual TransactionEvent is confirmed
        var observedCommand = commandService.getCommand(command.id()).orElseThrow();
        assertThat(observedCommand.status()).isEqualTo(CommandStatus.OBSERVED);
        assertThat(observedCommand.observedAt()).isNotNull();
        assertThat(observedCommand.transactionId()).isEqualTo(txId);
    }

    @Test
    void shouldExecuteFullCommandLifecycleForRequestStopTransaction() {
        String stationId = "STATION-CMD-02";
        String txId = "tx-cmd-stop-" + UUID.randomUUID();

        // 1. First start transaction so transaction service knows about it
        String txStartedCall = """
                [2, "msg-tx-start-002", "TransactionEvent", {
                    "eventType": "Started",
                    "timestamp": "2026-11-27T17:40:00Z",
                    "triggerReason": "Authorized",
                    "seqNo": 0,
                    "transactionInfo": { "transactionId": "%s" },
                    "evse": { "id": 1, "connectorId": 1 }
                }]
                """.formatted(txId);
        messageProcessor.process(stationId, txStartedCall);

        // 2. Request stop transaction
        var stopCommand = commandService.requestStopTransaction(
                stationId,
                txId,
                "stop-idemp-" + UUID.randomUUID()
        );
        assertThat(stopCommand.status()).isEqualTo(CommandStatus.PENDING);

        // 3. Station responds Accepted
        String callResultJson = """
                [3, "%s", {"status": "Accepted"}]
                """.formatted(stopCommand.messageId());
        messageProcessor.process(stationId, callResultJson);

        var acceptedStop = commandService.getCommand(stopCommand.id()).orElseThrow();
        assertThat(acceptedStop.status()).isEqualTo(CommandStatus.ACCEPTED);

        // 4. Station sends TransactionEvent(eventType: Ended)
        String txEndedCall = """
                [2, "msg-tx-end-002", "TransactionEvent", {
                    "eventType": "Ended",
                    "timestamp": "2026-11-27T17:45:00Z",
                    "triggerReason": "RemoteStop",
                    "seqNo": 1,
                    "transactionInfo": { "transactionId": "%s" }
                }]
                """.formatted(txId);
        messageProcessor.process(stationId, txEndedCall);

        var observedStop = commandService.getCommand(stopCommand.id()).orElseThrow();
        assertThat(observedStop.status()).isEqualTo(CommandStatus.OBSERVED);
        assertThat(observedStop.observedAt()).isNotNull();
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

        // Station responds with CALL_ERROR [4, "<messageId>", "NotSupported", "Feature disabled", {}]
        String callErrorJson = """
                [4, "%s", "NotSupported", "Feature disabled", {}]
                """.formatted(command.messageId());

        messageProcessor.process(stationId, callErrorJson);

        var updatedCommand = commandService.getCommand(command.id()).orElseThrow();
        assertThat(updatedCommand.status()).isEqualTo(CommandStatus.REJECTED);
        assertThat(updatedCommand.responsePayload()).contains("NotSupported");
    }
}
