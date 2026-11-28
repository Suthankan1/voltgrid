package com.voltgrid.station.api.ocpp;

import com.voltgrid.station.application.StationCommandService;
import com.voltgrid.station.application.StationConnectivityService;
import com.voltgrid.station.application.StationReader;
import com.voltgrid.station.domain.StationStatus;
import com.voltgrid.station.infrastructure.lifecycle.ApplicationShutdownState;
import com.voltgrid.station.support.PostgresTestConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@SpringBootTest(
        properties = {
                "voltgrid.kafka.outbox.relay-enabled=false",
                "voltgrid.ocpp.auth-required=false",
                "voltgrid.security.require-auth=false"
        }
)
@Import(PostgresTestConfiguration.class)
class MultiInstanceStationFencingIntegrationTests {

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
        var commandService = mock(StationCommandService.class);
        instance1Handler.setCommandService(commandService);
        instance2Handler.setCommandService(commandService);

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
        verify(commandService, never()).handleStationDisconnect(stationId);

        // Invariant: Station must REMAIN ONLINE because Instance 1's generation is fenced and stale!
        var stationAfterStaleDisconnect = stationReader.findById(stationId).orElseThrow();
        assertThat(stationAfterStaleDisconnect.status())
                .as("Station must remain ONLINE when old instance tears down stale session")
                .isEqualTo(StationStatus.ONLINE);
        assertThat(stationAfterStaleDisconnect.connectionGeneration()).isEqualTo(gen2);

        // Instance 2 finally tears down active session -> station transitions to OFFLINE
        instance2Handler.afterConnectionClosed(sessionInstance2, CloseStatus.NORMAL);
        verify(commandService).handleStationDisconnect(stationId);

        var stationAfterLegitDisconnect = stationReader.findById(stationId).orElseThrow();
        assertThat(stationAfterLegitDisconnect.status())
                .as("Station transitions to OFFLINE when active generation disconnects")
                .isEqualTo(StationStatus.OFFLINE);
        assertThat(stationAfterLegitDisconnect.statusSequenceNumber()).isGreaterThan(seq1);
    }

    @Test
    void concurrentRegistrationsGetDistinctGenerations() throws Exception {
        String stationId = "STATION-FENCE-001";
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> {
                start.await();
                return connectivityService.registerConnection(stationId, Instant.now());
            });
            var second = executor.submit(() -> {
                start.await();
                return connectivityService.registerConnection(stationId, Instant.now());
            });

            start.countDown();
            long firstGeneration = first.get(10, TimeUnit.SECONDS);
            long secondGeneration = second.get(10, TimeUnit.SECONDS);
            assertThat(firstGeneration).isNotEqualTo(secondGeneration);
            assertThat(stationReader.findById(stationId).orElseThrow().connectionGeneration())
                    .isEqualTo(Math.max(firstGeneration, secondGeneration));
        }
    }

    @Test
    void rollsBackOfflineTransitionWhenDisconnectCleanupFails() {
        String stationId = "STATION-FENCE-002";
        long generation = connectivityService.registerConnection(stationId, Instant.now());

        assertThatThrownBy(() -> connectivityService.markOfflineIfGenerationMatches(stationId, generation, () -> {
            throw new IllegalStateException("Synthetic command cleanup failure");
        })).isInstanceOf(IllegalStateException.class);

        assertThat(stationReader.findById(stationId).orElseThrow().status()).isEqualTo(StationStatus.ONLINE);
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
