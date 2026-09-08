package com.voltgrid.station.api.ocpp;

import com.voltgrid.station.application.InvalidTransactionSequenceException;
import com.voltgrid.station.application.StationConnectivityService;
import com.voltgrid.station.application.StationConnectorStatusService;
import com.voltgrid.station.application.StationTransactionService;
import com.voltgrid.station.application.TransactionNotFoundException;
import com.voltgrid.station.domain.ConnectorStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class OcppMessageProcessorTests {

    @Mock
    private StationConnectivityService connectivityService;

    @Mock
    private StationConnectorStatusService connectorStatusService;

    @Mock
    private StationTransactionService transactionService;

    private JsonMapper jsonMapper;
    private OcppMessageProcessor processor;

    @BeforeEach
    void setUp() {
        jsonMapper = new JsonMapper();

        processor = new OcppMessageProcessor(
                jsonMapper,
                connectivityService,
                connectorStatusService,
                transactionService
        );
    }

    @Test
    void shouldHandleBootNotification() {
        var response = processor.process(
                "STATION-003",
                """
                [
                  2,
                  "boot-001",
                  "BootNotification",
                  {
                    "reason": "PowerUp",
                    "chargingStation": {
                      "model": "VoltGrid-Sim-1",
                      "vendorName": "VoltGrid"
                    }
                  }
                ]
                """
        );

        var json = jsonMapper.readTree(response);

        assertThat(json.get(0).intValue())
                .isEqualTo(3);

        assertThat(json.get(1).stringValue())
                .isEqualTo("boot-001");

        assertThat(
                json.get(2)
                        .get("status")
                        .stringValue()
        ).isEqualTo("Accepted");

        assertThat(
                json.get(2)
                        .get("interval")
                        .intValue()
        ).isEqualTo(300);

        assertThat(
                json.get(2)
                        .get("currentTime")
                        .stringValue()
        ).isNotBlank();

        verify(connectivityService)
                .markOnline(
                        eq("STATION-003"),
                        any(Instant.class)
                );

        verifyNoInteractions(
                connectorStatusService,
                transactionService
        );
    }

    @Test
    void shouldHandleHeartbeat() {
        var response = processor.process(
                "STATION-003",
                """
                [
                  2,
                  "heartbeat-001",
                  "Heartbeat",
                  {}
                ]
                """
        );

        var json = jsonMapper.readTree(response);

        assertThat(json.get(0).intValue())
                .isEqualTo(3);

        assertThat(json.get(1).stringValue())
                .isEqualTo("heartbeat-001");

        assertThat(
                json.get(2)
                        .get("currentTime")
                        .stringValue()
        ).isNotBlank();

        verify(connectivityService)
                .recordActivity(
                        eq("STATION-003"),
                        any(Instant.class)
                );

        verifyNoInteractions(
                connectorStatusService,
                transactionService
        );
    }

    @Test
    void shouldHandleStatusNotification() {
        var response = processor.process(
                "STATION-003",
                """
                [
                  2,
                  "status-001",
                  "StatusNotification",
                  {
                    "timestamp": "2026-09-08T05:30:00Z",
                    "connectorStatus": "Available",
                    "evseId": 1,
                    "connectorId": 1
                  }
                ]
                """
        );

        var json = jsonMapper.readTree(response);

        assertThat(json.get(0).intValue())
                .isEqualTo(3);

        assertThat(json.get(1).stringValue())
                .isEqualTo("status-001");

        assertThat(json.get(2).isObject())
                .isTrue();

        assertThat(json.get(2).size())
                .isZero();

        verify(connectorStatusService)
                .updateStatus(
                        "STATION-003",
                        1,
                        1,
                        ConnectorStatus.AVAILABLE,
                        Instant.parse(
                                "2026-09-08T05:30:00Z"
                        )
                );

        verify(connectivityService)
                .recordActivity(
                        eq("STATION-003"),
                        any(Instant.class)
                );

        verifyNoInteractions(
                transactionService
        );
    }

    @Test
    void shouldHandleStartedTransactionEvent() {
        var response = processor.process(
                "STATION-003",
                """
                [
                  2,
                  "tx-event-001",
                  "TransactionEvent",
                  {
                    "eventType": "Started",
                    "timestamp": "2026-09-08T10:30:00Z",
                    "triggerReason": "CablePluggedIn",
                    "seqNo": 0,
                    "transactionInfo": {
                      "transactionId": "TX-001",
                      "chargingState": "EVConnected"
                    },
                    "evse": {
                      "id": 1,
                      "connectorId": 1
                    }
                  }
                ]
                """
        );

        var json = jsonMapper.readTree(response);

        assertThat(json.get(0).intValue())
                .isEqualTo(3);

        assertThat(json.get(1).stringValue())
                .isEqualTo("tx-event-001");

        assertThat(json.get(2).size())
                .isZero();

        verify(transactionService)
                .startTransaction(
                        "STATION-003",
                        "TX-001",
                        1,
                        1,
                        Instant.parse(
                                "2026-09-08T10:30:00Z"
                        ),
                        0
                );

        verify(connectivityService)
                .recordActivity(
                        eq("STATION-003"),
                        any(Instant.class)
                );

        verifyNoInteractions(
                connectorStatusService
        );
    }

    @Test
    void shouldHandleEndedTransactionEvent() {
        var response = processor.process(
                "STATION-003",
                """
                [
                  2,
                  "tx-event-004",
                  "TransactionEvent",
                  {
                    "eventType": "Ended",
                    "timestamp": "2026-09-08T11:15:00Z",
                    "triggerReason": "EVDeparted",
                    "seqNo": 1,
                    "transactionInfo": {
                      "transactionId": "TX-001",
                      "chargingState": "Idle",
                      "stoppedReason": "EVDisconnected"
                    },
                    "evse": {
                      "id": 1,
                      "connectorId": 1
                    }
                  }
                ]
                """
        );

        var json = jsonMapper.readTree(response);

        assertThat(json.get(0).intValue())
                .isEqualTo(3);

        assertThat(json.get(1).stringValue())
                .isEqualTo("tx-event-004");

        assertThat(json.get(2).isObject())
                .isTrue();

        assertThat(json.get(2).size())
                .isZero();

        verify(transactionService)
                .endTransaction(
                        "STATION-003",
                        "TX-001",
                        Instant.parse(
                                "2026-09-08T11:15:00Z"
                        ),
                        1
                );

        verify(connectivityService)
                .recordActivity(
                        eq("STATION-003"),
                        any(Instant.class)
                );

        verifyNoInteractions(
                connectorStatusService
        );
    }

    @Test
    void shouldReturnOccurrenceConstraintViolationWhenTransactionDoesNotExist() {
        doThrow(
                new TransactionNotFoundException(
                        "STATION-003",
                        "TX-404"
                )
        ).when(transactionService)
                .endTransaction(
                        "STATION-003",
                        "TX-404",
                        Instant.parse(
                                "2026-09-08T11:15:00Z"
                        ),
                        1
                );

        var response = processor.process(
                "STATION-003",
                """
                [
                  2,
                  "tx-event-404",
                  "TransactionEvent",
                  {
                    "eventType": "Ended",
                    "timestamp": "2026-09-08T11:15:00Z",
                    "triggerReason": "EVDeparted",
                    "seqNo": 1,
                    "transactionInfo": {
                      "transactionId": "TX-404"
                    },
                    "evse": {
                      "id": 1,
                      "connectorId": 1
                    }
                  }
                ]
                """
        );

        var json = jsonMapper.readTree(response);

        assertThat(json.get(0).intValue())
                .isEqualTo(4);

        assertThat(json.get(1).stringValue())
                .isEqualTo("tx-event-404");

        assertThat(json.get(2).stringValue())
                .isEqualTo(
                        "OccurrenceConstraintViolation"
                );

        assertThat(json.get(3).stringValue())
                .contains(
                        "Transaction not found"
                );

        verifyNoInteractions(
                connectivityService,
                connectorStatusService
        );
    }

    @Test
    void shouldReturnOccurrenceConstraintViolationForInvalidSequenceNumber() {
        doThrow(
                new InvalidTransactionSequenceException(
                        3,
                        2
                )
        ).when(transactionService)
                .endTransaction(
                        "STATION-003",
                        "TX-001",
                        Instant.parse(
                                "2026-09-08T11:15:00Z"
                        ),
                        2
                );

        var response = processor.process(
                "STATION-003",
                """
                [
                  2,
                  "tx-event-sequence",
                  "TransactionEvent",
                  {
                    "eventType": "Ended",
                    "timestamp": "2026-09-08T11:15:00Z",
                    "triggerReason": "EVDeparted",
                    "seqNo": 2,
                    "transactionInfo": {
                      "transactionId": "TX-001"
                    },
                    "evse": {
                      "id": 1,
                      "connectorId": 1
                    }
                  }
                ]
                """
        );

        var json = jsonMapper.readTree(response);

        assertThat(json.get(0).intValue())
                .isEqualTo(4);

        assertThat(json.get(1).stringValue())
                .isEqualTo("tx-event-sequence");

        assertThat(json.get(2).stringValue())
                .isEqualTo(
                        "OccurrenceConstraintViolation"
                );

        assertThat(json.get(3).stringValue())
                .contains(
                        "Transaction sequence number"
                );

        verifyNoInteractions(
                connectivityService,
                connectorStatusService
        );
    }

    @Test
    void shouldRejectUnsupportedTransactionEventType() {
        var response = processor.process(
                "STATION-003",
                """
                [
                  2,
                  "tx-event-002",
                  "TransactionEvent",
                  {
                    "eventType": "Updated",
                    "timestamp": "2026-09-08T10:35:00Z",
                    "triggerReason": "MeterValuePeriodic",
                    "seqNo": 1,
                    "transactionInfo": {
                      "transactionId": "TX-001"
                    },
                    "evse": {
                      "id": 1,
                      "connectorId": 1
                    }
                  }
                ]
                """
        );

        var json = jsonMapper.readTree(response);

        assertThat(json.get(0).intValue())
                .isEqualTo(4);

        assertThat(json.get(1).stringValue())
                .isEqualTo("tx-event-002");

        assertThat(json.get(2).stringValue())
                .isEqualTo("NotImplemented");

        assertThat(json.get(3).stringValue())
                .isEqualTo(
                        "TransactionEvent type not implemented: Updated"
                );

        verifyNoInteractions(
                connectivityService,
                connectorStatusService,
                transactionService
        );
    }

    @Test
    void shouldRejectInvalidTransactionEventTimestamp() {
        var response = processor.process(
                "STATION-003",
                """
                [
                  2,
                  "tx-event-003",
                  "TransactionEvent",
                  {
                    "eventType": "Started",
                    "timestamp": "not-a-timestamp",
                    "triggerReason": "CablePluggedIn",
                    "seqNo": 0,
                    "transactionInfo": {
                      "transactionId": "TX-001"
                    },
                    "evse": {
                      "id": 1,
                      "connectorId": 1
                    }
                  }
                ]
                """
        );

        var json = jsonMapper.readTree(response);

        assertThat(json.get(0).intValue())
                .isEqualTo(4);

        assertThat(json.get(1).stringValue())
                .isEqualTo("tx-event-003");

        assertThat(json.get(2).stringValue())
                .isEqualTo("FormatViolation");

        assertThat(json.get(3).stringValue())
                .isEqualTo(
                        "Invalid TransactionEvent timestamp"
                );

        verifyNoInteractions(
                connectivityService,
                connectorStatusService,
                transactionService
        );
    }

    @Test
    void shouldRejectInvalidConnectorStatus() {
        var response = processor.process(
                "STATION-003",
                """
                [
                  2,
                  "status-002",
                  "StatusNotification",
                  {
                    "timestamp": "2026-09-08T05:30:00Z",
                    "connectorStatus": "Exploded",
                    "evseId": 1,
                    "connectorId": 1
                  }
                ]
                """
        );

        var json = jsonMapper.readTree(response);

        assertThat(json.get(0).intValue())
                .isEqualTo(4);

        assertThat(json.get(1).stringValue())
                .isEqualTo("status-002");

        assertThat(json.get(2).stringValue())
                .isEqualTo("FormatViolation");

        assertThat(json.get(3).stringValue())
                .isEqualTo(
                        "Invalid connector status"
                );

        verifyNoInteractions(
                connectivityService,
                connectorStatusService,
                transactionService
        );
    }

    @Test
    void shouldRejectInvalidStatusNotificationTimestamp() {
        var response = processor.process(
                "STATION-003",
                """
                [
                  2,
                  "status-003",
                  "StatusNotification",
                  {
                    "timestamp": "not-a-timestamp",
                    "connectorStatus": "Available",
                    "evseId": 1,
                    "connectorId": 1
                  }
                ]
                """
        );

        var json = jsonMapper.readTree(response);

        assertThat(json.get(0).intValue())
                .isEqualTo(4);

        assertThat(json.get(1).stringValue())
                .isEqualTo("status-003");

        assertThat(json.get(2).stringValue())
                .isEqualTo("FormatViolation");

        assertThat(json.get(3).stringValue())
                .isEqualTo(
                        "Invalid StatusNotification timestamp"
                );

        verifyNoInteractions(
                connectivityService,
                connectorStatusService,
                transactionService
        );
    }

    @Test
    void shouldReturnNotImplementedForUnsupportedAction() {
        var response = processor.process(
                "STATION-003",
                """
                [
                  2,
                  "msg-001",
                  "Authorize",
                  {}
                ]
                """
        );

        var json = jsonMapper.readTree(response);

        assertThat(json.get(0).intValue())
                .isEqualTo(4);

        assertThat(json.get(1).stringValue())
                .isEqualTo("msg-001");

        assertThat(json.get(2).stringValue())
                .isEqualTo("NotImplemented");

        assertThat(json.get(3).stringValue())
                .isEqualTo(
                        "Action not implemented: Authorize"
                );

        verifyNoInteractions(
                connectivityService,
                connectorStatusService,
                transactionService
        );
    }

    @Test
    void shouldReturnFormatViolationForInvalidBootNotification() {
        var response = processor.process(
                "STATION-003",
                """
                [
                  2,
                  "boot-002",
                  "BootNotification",
                  {
                    "reason": "PowerUp",
                    "chargingStation": {
                      "model": "VoltGrid-Sim-1"
                    }
                  }
                ]
                """
        );

        var json = jsonMapper.readTree(response);

        assertThat(json.get(0).intValue())
                .isEqualTo(4);

        assertThat(json.get(1).stringValue())
                .isEqualTo("boot-002");

        assertThat(json.get(2).stringValue())
                .isEqualTo("FormatViolation");

        assertThat(json.get(3).stringValue())
                .isEqualTo(
                        "Invalid BootNotification payload"
                );

        verifyNoInteractions(
                connectivityService,
                connectorStatusService,
                transactionService
        );
    }
}