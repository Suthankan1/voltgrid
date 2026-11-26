package com.voltgrid.station.api.ocpp;

import com.voltgrid.station.application.StationConnectivityService;
import com.voltgrid.station.infrastructure.lifecycle.ApplicationShutdownState;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

import java.util.HashMap;
import java.util.Map;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OcppWebSocketHandlerTests {

    @Mock
    private OcppMessageProcessor messageProcessor;

    @Mock
    private StationConnectivityService connectivityService;

    @Mock
    private ApplicationShutdownState shutdownState;

    @Mock
    private WebSocketSession session1;

    @Mock
    private WebSocketSession session2;

    private OcppWebSocketHandler handler;

    @BeforeEach
    void setUp() {
        handler = new OcppWebSocketHandler(
                messageProcessor,
                connectivityService,
                shutdownState
        );
    }

    @Test
    void shouldMarkOfflineWhenActiveSessionCloses() throws Exception {
        Map<String, Object> attributes = new HashMap<>();
        attributes.put(OcppHandshakeInterceptor.STATION_ID_ATTRIBUTE, "STATION-001");

        when(session1.getAttributes()).thenReturn(attributes);
        when(session1.getId()).thenReturn("sess-1");
        when(shutdownState.isShuttingDown()).thenReturn(false);

        handler.afterConnectionEstablished(session1);
        handler.afterConnectionClosed(session1, CloseStatus.NORMAL);

        verify(connectivityService).markOffline("STATION-001");
    }

    @Test
    void shouldNotMarkOfflineWhenSupersededSessionCloses() throws Exception {
        Map<String, Object> attributes1 = new HashMap<>();
        attributes1.put(OcppHandshakeInterceptor.STATION_ID_ATTRIBUTE, "STATION-001");

        Map<String, Object> attributes2 = new HashMap<>();
        attributes2.put(OcppHandshakeInterceptor.STATION_ID_ATTRIBUTE, "STATION-001");

        when(session1.getAttributes()).thenReturn(attributes1);
        when(session1.getId()).thenReturn("sess-1");

        when(session2.getAttributes()).thenReturn(attributes2);
        when(session2.getId()).thenReturn("sess-2");

        when(shutdownState.isShuttingDown()).thenReturn(false);

        // Session 1 connects
        handler.afterConnectionEstablished(session1);

        // Session 2 connects (reconnection before session 1 cleanly tears down)
        handler.afterConnectionEstablished(session2);

        // Session 1 closes
        handler.afterConnectionClosed(session1, CloseStatus.NORMAL);

        // Should NOT mark offline because session 2 is the active session
        verify(connectivityService, never()).markOffline("STATION-001");

        // When session 2 finally closes, it marks offline
        handler.afterConnectionClosed(session2, CloseStatus.NORMAL);
        verify(connectivityService).markOffline("STATION-001");
    }
}
