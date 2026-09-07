package com.voltgrid.station.api.ocpp;

import com.voltgrid.station.application.StationConnectivityService;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class OcppMessageProcessorTests {

    @Mock
    private StationConnectivityService connectivityService;

    private JsonMapper jsonMapper;
    private OcppMessageProcessor processor;

    @BeforeEach
    void setUp() {
        jsonMapper = new JsonMapper();

        processor = new OcppMessageProcessor(
                jsonMapper,
                connectivityService
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
                .recordHeartbeat(
                        eq("STATION-003"),
                        any(Instant.class)
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
                  "StatusNotification",
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
                        "Action not implemented: StatusNotification"
                );

        verifyNoInteractions(connectivityService);
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

        verifyNoInteractions(connectivityService);
    }
}