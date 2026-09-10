package com.voltgrid.station.api.ocpp;

import com.voltgrid.station.application.AuthorizationClient;
import com.voltgrid.station.application.AuthorizationOutcome;
import com.voltgrid.station.application.AuthorizationReasonCode;
import com.voltgrid.station.application.AuthorizationResult;
import com.voltgrid.station.application.ConflictingTransactionEventException;
import com.voltgrid.station.application.InvalidTransactionSequenceException;
import com.voltgrid.station.application.StationConnectivityService;
import com.voltgrid.station.application.StationConnectorStatusService;
import com.voltgrid.station.application.StationTransactionService;
import com.voltgrid.station.application.TransactionNotActiveException;
import com.voltgrid.station.application.TransactionNotFoundException;
import com.voltgrid.station.domain.ConnectorStatus;
import com.voltgrid.station.domain.TransactionEventType;
import com.voltgrid.station.domain.TransactionMeterSample;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OcppMessageProcessorTests {

    @Mock
    private StationConnectivityService connectivityService;

    @Mock
    private StationConnectorStatusService connectorStatusService;

    @Mock
    private StationTransactionService transactionService;

    @Mock
    private AuthorizationClient authorizationClient;

    private JsonMapper jsonMapper;
    private OcppMessageProcessor processor;

    @BeforeEach
    void setUp() {
        jsonMapper = new JsonMapper();

        processor = new OcppMessageProcessor(
                jsonMapper,
                connectivityService,
                connectorStatusService,
                transactionService,
                authorizationClient
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
                transactionService,
                authorizationClient
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
                transactionService,
                authorizationClient
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
                transactionService,
                authorizationClient
        );
    }

    @Test
    void shouldAuthorizeToken() {
        when(
                authorizationClient.authorize(
                        "STATION-003",
                        "RFID-123"
                )
        ).thenReturn(
                new AuthorizationResult(
                        AuthorizationOutcome.ACCEPTED,
                        AuthorizationReasonCode.ALLOWED
                )
        );

        var response = processor.process(
                "STATION-003",
                """
                [
                  2,
                  "auth-001",
                  "Authorize",
                  {
                    "idToken": {
                      "idToken": "RFID-123",
                      "type": "ISO14443"
                    }
                  }
                ]
                """
        );

        var json = jsonMapper.readTree(response);

        assertThat(json.get(0).intValue())
                .isEqualTo(3);

        assertThat(json.get(1).stringValue())
                .isEqualTo("auth-001");

        assertThat(
                json.get(2)
                        .get("idTokenInfo")
                        .get("status")
                        .stringValue()
        ).isEqualTo("Accepted");

        verify(authorizationClient)
                .authorize(
                        "STATION-003",
                        "RFID-123"
                );

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
    void shouldReturnInvalidForUnknownToken() {
        when(
                authorizationClient.authorize(
                        "STATION-003",
                        "UNKNOWN"
                )
        ).thenReturn(
                new AuthorizationResult(
                        AuthorizationOutcome.REJECTED,
                        AuthorizationReasonCode.UNKNOWN_TOKEN
                )
        );

        var response = processor.process(
                "STATION-003",
                """
                [
                  2,
                  "auth-002",
                  "Authorize",
                  {
                    "idToken": {
                      "idToken": "UNKNOWN",
                      "type": "ISO14443"
                    }
                  }
                ]
                """
        );

        var json = jsonMapper.readTree(response);

        assertThat(json.get(0).intValue())
                .isEqualTo(3);

        assertThat(json.get(1).stringValue())
                .isEqualTo("auth-002");

        assertThat(
                json.get(2)
                        .get("idTokenInfo")
                        .get("status")
                        .stringValue()
        ).isEqualTo("Invalid");

        verify(authorizationClient)
                .authorize(
                        "STATION-003",
                        "UNKNOWN"
                );

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
    void shouldReturnBlockedForInactiveToken() {
        when(
                authorizationClient.authorize(
                        "STATION-003",
                        "INACTIVE"
                )
        ).thenReturn(
                new AuthorizationResult(
                        AuthorizationOutcome.REJECTED,
                        AuthorizationReasonCode.INACTIVE_TOKEN
                )
        );

        var response = processor.process(
                "STATION-003",
                """
                [
                  2,
                  "auth-003",
                  "Authorize",
                  {
                    "idToken": {
                      "idToken": "INACTIVE",
                      "type": "ISO14443"
                    }
                  }
                ]
                """
        );

        var json = jsonMapper.readTree(response);

        assertThat(
                json.get(2)
                        .get("idTokenInfo")
                        .get("status")
                        .stringValue()
        ).isEqualTo("Blocked");

        verify(authorizationClient)
                .authorize(
                        "STATION-003",
                        "INACTIVE"
                );
    }

    @Test
    void shouldReturnNotAtThisLocationWhenStationIsNotAllowed() {
        when(
                authorizationClient.authorize(
                        "STATION-003",
                        "RFID-RESTRICTED"
                )
        ).thenReturn(
                new AuthorizationResult(
                        AuthorizationOutcome.REJECTED,
                        AuthorizationReasonCode.STATION_NOT_ALLOWED
                )
        );

        var response = processor.process(
                "STATION-003",
                """
                [
                  2,
                  "auth-004",
                  "Authorize",
                  {
                    "idToken": {
                      "idToken": "RFID-RESTRICTED",
                      "type": "ISO14443"
                    }
                  }
                ]
                """
        );

        var json = jsonMapper.readTree(response);

        assertThat(
                json.get(2)
                        .get("idTokenInfo")
                        .get("status")
                        .stringValue()
        ).isEqualTo("NotAtThisLocation");

        verify(authorizationClient)
                .authorize(
                        "STATION-003",
                        "RFID-RESTRICTED"
                );
    }

    @Test
    void shouldRejectAuthorizeWithoutIdToken() {
        var response = processor.process(
                "STATION-003",
                """
                [
                  2,
                  "auth-invalid",
                  "Authorize",
                  {}
                ]
                """
        );

        var json = jsonMapper.readTree(response);

        assertThat(json.get(0).intValue())
                .isEqualTo(4);

        assertThat(json.get(1).stringValue())
                .isEqualTo("auth-invalid");

        assertThat(json.get(2).stringValue())
                .isEqualTo("FormatViolation");

        assertThat(json.get(3).stringValue())
                .isEqualTo("Invalid Authorize payload");

        verifyNoInteractions(
                connectivityService,
                connectorStatusService,
                transactionService,
                authorizationClient
        );
    }

    @Test
    void shouldRejectAuthorizeWithBlankIdToken() {
        var response = processor.process(
                "STATION-003",
                """
                [
                  2,
                  "auth-blank",
                  "Authorize",
                  {
                    "idToken": {
                      "idToken": "",
                      "type": "ISO14443"
                    }
                  }
                ]
                """
        );

        var json = jsonMapper.readTree(response);

        assertThat(json.get(0).intValue())
                .isEqualTo(4);

        assertThat(json.get(2).stringValue())
                .isEqualTo("FormatViolation");

        verifyNoInteractions(
                connectivityService,
                connectorStatusService,
                transactionService,
                authorizationClient
        );
    }

    @Test
    void shouldRejectAuthorizeWithUnsupportedIdTokenType() {
        var response = processor.process(
                "STATION-003",
                """
                [
                  2,
                  "auth-invalid-type",
                  "Authorize",
                  {
                    "idToken": {
                      "idToken": "RFID-123",
                      "type": "SomethingElse"
                    }
                  }
                ]
                """
        );

        var json = jsonMapper.readTree(response);

        assertThat(json.get(0).intValue())
                .isEqualTo(4);

        assertThat(json.get(2).stringValue())
                .isEqualTo("FormatViolation");

        verifyNoInteractions(
                connectivityService,
                connectorStatusService,
                transactionService,
                authorizationClient
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

        assertThat(json.get(2).isObject())
                .isTrue();

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
                connectorStatusService,
                authorizationClient
        );
    }

    @Test
    void shouldHandleUpdatedTransactionEventWithoutMeterValues() {
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
                    }
                  }
                ]
                """
        );

        var json = jsonMapper.readTree(response);

        assertThat(json.get(0).intValue())
                .isEqualTo(3);

        assertThat(json.get(1).stringValue())
                .isEqualTo("tx-event-002");

        assertThat(json.get(2).isObject())
                .isTrue();

        assertThat(json.get(2).size())
                .isZero();

        verify(transactionService)
                .updateTransaction(
                        "STATION-003",
                        "TX-001",
                        1,
                        List.of()
                );

        verify(connectivityService)
                .recordActivity(
                        eq("STATION-003"),
                        any(Instant.class)
                );

        verifyNoInteractions(
                connectorStatusService,
                authorizationClient
        );
    }

    @Test
    void shouldHandleUpdatedTransactionEventWithMeterValues() {
        var response = processor.process(
                "STATION-003",
                """
                [
                  2,
                  "tx-event-meter-001",
                  "TransactionEvent",
                  {
                    "eventType": "Updated",
                    "timestamp": "2026-09-08T10:35:00Z",
                    "triggerReason": "MeterValuePeriodic",
                    "seqNo": 1,
                    "transactionInfo": {
                      "transactionId": "TX-001"
                    },
                    "meterValue": [
                      {
                        "timestamp": "2026-09-08T10:35:00Z",
                        "sampledValue": [
                          {
                            "value": 1250.5,
                            "context": "Sample.Periodic",
                            "measurand": "Energy.Active.Import.Register",
                            "location": "Outlet",
                            "unitOfMeasure": {
                              "unit": "Wh",
                              "multiplier": 0
                            }
                          },
                          {
                            "value": 7200,
                            "context": "Sample.Periodic",
                            "measurand": "Power.Active.Import",
                            "location": "Outlet",
                            "unitOfMeasure": {
                              "unit": "W",
                              "multiplier": 0
                            }
                          }
                        ]
                      }
                    ]
                  }
                ]
                """
        );

        var json = jsonMapper.readTree(response);

        assertThat(json.get(0).intValue())
                .isEqualTo(3);

        assertThat(json.get(1).stringValue())
                .isEqualTo(
                        "tx-event-meter-001"
                );

        assertThat(json.get(2).isObject())
                .isTrue();

        assertThat(json.get(2).size())
                .isZero();

        var expectedSamples = List.of(
                new TransactionMeterSample(
                        "STATION-003",
                        "TX-001",
                        1,
                        Instant.parse(
                                "2026-09-08T10:35:00Z"
                        ),
                        new BigDecimal("1250.5"),
                        "Energy.Active.Import.Register",
                        "Sample.Periodic",
                        null,
                        "Outlet",
                        "Wh",
                        0
                ),
                new TransactionMeterSample(
                        "STATION-003",
                        "TX-001",
                        1,
                        Instant.parse(
                                "2026-09-08T10:35:00Z"
                        ),
                        new BigDecimal("7200"),
                        "Power.Active.Import",
                        "Sample.Periodic",
                        null,
                        "Outlet",
                        "W",
                        0
                )
        );

        verify(transactionService)
                .updateTransaction(
                        "STATION-003",
                        "TX-001",
                        1,
                        expectedSamples
                );

        verify(connectivityService)
                .recordActivity(
                        eq("STATION-003"),
                        any(Instant.class)
                );

        verifyNoInteractions(
                connectorStatusService,
                authorizationClient
        );
    }

    @Test
    void shouldRejectInvalidMeterValueTimestamp() {
        var response = processor.process(
                "STATION-003",
                """
                [
                  2,
                  "tx-event-meter-invalid",
                  "TransactionEvent",
                  {
                    "eventType": "Updated",
                    "timestamp": "2026-09-08T10:35:00Z",
                    "triggerReason": "MeterValuePeriodic",
                    "seqNo": 1,
                    "transactionInfo": {
                      "transactionId": "TX-001"
                    },
                    "meterValue": [
                      {
                        "timestamp": "not-a-timestamp",
                        "sampledValue": [
                          {
                            "value": 1250.5,
                            "measurand": "Energy.Active.Import.Register"
                          }
                        ]
                      }
                    ]
                  }
                ]
                """
        );

        var json = jsonMapper.readTree(response);

        assertThat(json.get(0).intValue())
                .isEqualTo(4);

        assertThat(json.get(1).stringValue())
                .isEqualTo(
                        "tx-event-meter-invalid"
                );

        assertThat(json.get(2).stringValue())
                .isEqualTo("FormatViolation");

        assertThat(json.get(3).stringValue())
                .isEqualTo(
                        "Invalid meter value timestamp"
                );

        verifyNoInteractions(
                connectivityService,
                connectorStatusService,
                transactionService,
                authorizationClient
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
                    "seqNo": 3,
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
                        3
                );

        verify(connectivityService)
                .recordActivity(
                        eq("STATION-003"),
                        any(Instant.class)
                );

        verifyNoInteractions(
                connectorStatusService,
                authorizationClient
        );
    }

    @Test
    void shouldRejectUpdatedEventForInvalidTransactionState() {
        doThrow(
                new TransactionNotActiveException(
                        "STATION-003",
                        "TX-001"
                )
        ).when(transactionService)
                .updateTransaction(
                        "STATION-003",
                        "TX-001",
                        4,
                        List.of()
                );

        var response = processor.process(
                "STATION-003",
                """
                [
                  2,
                  "tx-event-invalid-state",
                  "TransactionEvent",
                  {
                    "eventType": "Updated",
                    "timestamp": "2026-09-08T11:20:00Z",
                    "triggerReason": "MeterValuePeriodic",
                    "seqNo": 4,
                    "transactionInfo": {
                      "transactionId": "TX-001"
                    }
                  }
                ]
                """
        );

        var json = jsonMapper.readTree(response);

        assertThat(json.get(0).intValue())
                .isEqualTo(4);

        assertThat(json.get(1).stringValue())
                .isEqualTo(
                        "tx-event-invalid-state"
                );

        assertThat(json.get(2).stringValue())
                .isEqualTo(
                        "OccurrenceConstraintViolation"
                );

        assertThat(json.get(3).stringValue())
                .contains(
                        "Transaction is not active"
                );

        verifyNoInteractions(
                connectivityService,
                connectorStatusService,
                authorizationClient
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
                connectorStatusService,
                authorizationClient
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
                    }
                  }
                ]
                """
        );

        var json = jsonMapper.readTree(response);

        assertThat(json.get(0).intValue())
                .isEqualTo(4);

        assertThat(json.get(1).stringValue())
                .isEqualTo(
                        "tx-event-sequence"
                );

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
                connectorStatusService,
                authorizationClient
        );
    }

    @Test
    void shouldReturnOccurrenceConstraintViolationForConflictingTransactionEvent() {
        doThrow(
                new ConflictingTransactionEventException(
                        2,
                        TransactionEventType.ENDED,
                        TransactionEventType.UPDATED
                )
        ).when(transactionService)
                .updateTransaction(
                        "STATION-003",
                        "TX-001",
                        2,
                        List.of()
                );

        var response = processor.process(
                "STATION-003",
                """
                [
                  2,
                  "tx-event-conflict",
                  "TransactionEvent",
                  {
                    "eventType": "Updated",
                    "timestamp": "2026-09-08T10:40:00Z",
                    "triggerReason": "MeterValuePeriodic",
                    "seqNo": 2,
                    "transactionInfo": {
                      "transactionId": "TX-001"
                    }
                  }
                ]
                """
        );

        var json = jsonMapper.readTree(response);

        assertThat(json.get(0).intValue())
                .isEqualTo(4);

        assertThat(json.get(1).stringValue())
                .isEqualTo(
                        "tx-event-conflict"
                );

        assertThat(json.get(2).stringValue())
                .isEqualTo(
                        "OccurrenceConstraintViolation"
                );

        assertThat(json.get(3).stringValue())
                .contains(
                        "already received"
                );

        verifyNoInteractions(
                connectivityService,
                connectorStatusService,
                authorizationClient
        );
    }

    @Test
    void shouldRejectUnsupportedTransactionEventType() {
        var response = processor.process(
                "STATION-003",
                """
                [
                  2,
                  "tx-event-unsupported",
                  "TransactionEvent",
                  {
                    "eventType": "SomethingElse",
                    "timestamp": "2026-09-08T10:35:00Z",
                    "triggerReason": "Other",
                    "seqNo": 1,
                    "transactionInfo": {
                      "transactionId": "TX-001"
                    }
                  }
                ]
                """
        );

        var json = jsonMapper.readTree(response);

        assertThat(json.get(0).intValue())
                .isEqualTo(4);

        assertThat(json.get(1).stringValue())
                .isEqualTo(
                        "tx-event-unsupported"
                );

        assertThat(json.get(2).stringValue())
                .isEqualTo("NotImplemented");

        assertThat(json.get(3).stringValue())
                .isEqualTo(
                        "TransactionEvent type not implemented: SomethingElse"
                );

        verifyNoInteractions(
                connectivityService,
                connectorStatusService,
                transactionService,
                authorizationClient
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
                transactionService,
                authorizationClient
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
                transactionService,
                authorizationClient
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
                transactionService,
                authorizationClient
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
                  "FirmwareStatusNotification",
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
                        "Action not implemented: FirmwareStatusNotification"
                );

        verifyNoInteractions(
                connectivityService,
                connectorStatusService,
                transactionService,
                authorizationClient
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
                transactionService,
                authorizationClient
        );
    }
}