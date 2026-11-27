package com.voltgrid.station.api.ocpp;

import com.voltgrid.station.application.StationConnectivityService;
import com.voltgrid.station.application.StationReader;
import com.voltgrid.station.domain.StationStatus;
import com.voltgrid.station.infrastructure.lifecycle.ApplicationShutdownState;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@SpringBootTest(
        properties = {
                "voltgrid.kafka.outbox.relay-enabled=false",
                "voltgrid.ocpp.auth-required=false",
                "voltgrid.security.require-auth=false"
        }
)
@Testcontainers
class MultiInstanceStationFencingIntegrationTests {

    @Container
    static final PostgreSQLContainer POSTGRES =
            new PostgreSQLContainer("postgres:18.6")
                    .withDatabaseName("voltgrid_station")
                    .withUsername("voltgrid")
                    .withPassword("voltgrid_dev");

    @DynamicPropertySource
    static void configurePostgres(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired
    private StationConnectivityService connectivityService;

    @Autowired
    private StationReader stationReader;

    @Autowired
    private com.voltgrid.station.application.StationWriter stationWriter;

    @Autowired
    private OcppMessageProcessor messageProcessor;

    @Autowired
    private ApplicationShutdownState shutdownState;

    private OcppWebSocketHandler instance1Handler;
    private OcppWebSocketHandler instance2Handler;

    @BeforeEach
    void setUp() {
        stationWriter.save(new com.voltgrid.station.domain.ChargingStation(
                "STATION-FENCE-001",
                "Fence Station 1",
                StationStatus.OFFLINE
        ));

        stationWriter.save(new com.voltgrid.station.domain.ChargingStation(
                "STATION-FENCE-002",
                "Fence Station 2",
                StationStatus.OFFLINE
        ));

        instance1Handler = new OcppWebSocketHandler(
                messageProcessor,
                connectivityService,
                shutdownState,
                null
        );

        instance2Handler = new OcppWebSocketHandler(
                messageProcessor,
                connectivityService,
                shutdownState,
                null
        );
    }

    @Test
    void shouldFenceStaleDisconnectFromPreviousInstanceWhenReconnectedToNewInstance() throws Exception {
        String stationId = "STATION-FENCE-001";
        Instant t1 = Instant.parse("2026-11-27T10:00:00Z");
        Instant t2 = Instant.parse("2026-11-27T10:00:05Z");

        // Simulate Instance 1 accepting connection for station
        WebSocketSession sessionInstance1 = mock(WebSocketSession.class);
        Map<String, Object> attrs1 = new HashMap<>();
        attrs1.put(OcppHandshakeInterceptor.STATION_ID_ATTRIBUTE, stationId);
        when(sessionInstance1.getAttributes()).thenReturn(attrs1);

        instance1Handler.afterConnectionEstablished(sessionInstance1);

        var stationAfterInstance1 = stationReader.findById(stationId).orElseThrow();
        assertThat(stationAfterInstance1.status()).isEqualTo(StationStatus.ONLINE);
        long gen1 = stationAfterInstance1.connectionGeneration();
        long seq1 = stationAfterInstance1.statusSequenceNumber();
        assertThat(gen1).isGreaterThan(0L);
        assertThat(seq1).isGreaterThan(0L);
        assertThat(attrs1.get(OcppWebSocketHandler.CONNECTION_GENERATION_ATTRIBUTE)).isEqualTo(gen1);

        // Simulate Station reconnecting to Instance 2 (multi-node cluster scenario)
        WebSocketSession sessionInstance2 = mock(WebSocketSession.class);
        Map<String, Object> attrs2 = new HashMap<>();
        attrs2.put(OcppHandshakeInterceptor.STATION_ID_ATTRIBUTE, stationId);
        when(sessionInstance2.getAttributes()).thenReturn(attrs2);

        instance2Handler.afterConnectionEstablished(sessionInstance2);

        var stationAfterInstance2 = stationReader.findById(stationId).orElseThrow();
        assertThat(stationAfterInstance2.status()).isEqualTo(StationStatus.ONLINE);
        long gen2 = stationAfterInstance2.connectionGeneration();
        assertThat(gen2).isGreaterThan(gen1);
        assertThat(attrs2.get(OcppWebSocketHandler.CONNECTION_GENERATION_ATTRIBUTE)).isEqualTo(gen2);

        // Now Instance 1 tears down its old socket (delayed socket cleanup on previous instance)
        instance1Handler.afterConnectionClosed(sessionInstance1, CloseStatus.NORMAL);

        // Invariant: Station must REMAIN ONLINE because Instance 1's generation is fenced and stale!
        var stationAfterStaleDisconnect = stationReader.findById(stationId).orElseThrow();
        assertThat(stationAfterStaleDisconnect.status())
                .as("Station must remain ONLINE when old instance tears down stale session")
                .isEqualTo(StationStatus.ONLINE);
        assertThat(stationAfterStaleDisconnect.connectionGeneration()).isEqualTo(gen2);

        // Instance 2 finally tears down active session -> station transitions to OFFLINE
        instance2Handler.afterConnectionClosed(sessionInstance2, CloseStatus.NORMAL);

        var stationAfterLegitDisconnect = stationReader.findById(stationId).orElseThrow();
        assertThat(stationAfterLegitDisconnect.status())
                .as("Station transitions to OFFLINE when active generation disconnects")
                .isEqualTo(StationStatus.OFFLINE);
        assertThat(stationAfterLegitDisconnect.statusSequenceNumber()).isGreaterThan(seq1);
    }

    @Test
    void shouldTerminateStaleSessionWhenMessageSentOnSupersededGeneration() throws Exception {
        String stationId = "STATION-FENCE-002";

        WebSocketSession sessionInstance1 = mock(WebSocketSession.class);
        Map<String, Object> attrs1 = new HashMap<>();
        attrs1.put(OcppHandshakeInterceptor.STATION_ID_ATTRIBUTE, stationId);
        when(sessionInstance1.getAttributes()).thenReturn(attrs1);

        instance1Handler.afterConnectionEstablished(sessionInstance1);

        // Reconnect to Instance 2
        WebSocketSession sessionInstance2 = mock(WebSocketSession.class);
        Map<String, Object> attrs2 = new HashMap<>();
        attrs2.put(OcppHandshakeInterceptor.STATION_ID_ATTRIBUTE, stationId);
        when(sessionInstance2.getAttributes()).thenReturn(attrs2);

        instance2Handler.afterConnectionEstablished(sessionInstance2);

        // Frame arrives on Instance 1 (stale socket)
        TextMessage staleMessage = new TextMessage("[2, \"msg1\", \"Heartbeat\", {}]");
        instance1Handler.handleTextMessage(sessionInstance1, staleMessage);

        // Verify Instance 1 terminated the socket due to superseded connection generation
        verify(sessionInstance1).close(CloseStatus.POLICY_VIOLATION.withReason("Superseded by newer connection generation"));
    }
}
