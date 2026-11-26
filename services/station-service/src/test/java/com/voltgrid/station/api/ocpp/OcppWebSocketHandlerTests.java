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

        when(session2.getAttributes()).thenReturn(attributes2);

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

    @Test
    void shouldHandleRapidReconnectLoopsAcrossMultipleSessions() throws Exception {
        Map<String, Object> attrs1 = new HashMap<>();
        attrs1.put(OcppHandshakeInterceptor.STATION_ID_ATTRIBUTE, "STATION-RECONNECT");
        Map<String, Object> attrs2 = new HashMap<>();
        attrs2.put(OcppHandshakeInterceptor.STATION_ID_ATTRIBUTE, "STATION-RECONNECT");
        Map<String, Object> attrs3 = new HashMap<>();
        attrs3.put(OcppHandshakeInterceptor.STATION_ID_ATTRIBUTE, "STATION-RECONNECT");

        when(session1.getAttributes()).thenReturn(attrs1);
        when(session2.getAttributes()).thenReturn(attrs2);

        var session3 = org.mockito.Mockito.mock(WebSocketSession.class);
        when(session3.getAttributes()).thenReturn(attrs3);

        when(shutdownState.isShuttingDown()).thenReturn(false);

        // Sequence: connect 1, connect 2, close 1, connect 3, close 2, close 3
        handler.afterConnectionEstablished(session1);
        handler.afterConnectionEstablished(session2);
        handler.afterConnectionClosed(session1, CloseStatus.NORMAL);

        verify(connectivityService, never()).markOffline("STATION-RECONNECT");

        handler.afterConnectionEstablished(session3);
        handler.afterConnectionClosed(session2, CloseStatus.NORMAL);

        verify(connectivityService, never()).markOffline("STATION-RECONNECT");

        // Finally session 3 closes
        handler.afterConnectionClosed(session3, CloseStatus.NORMAL);
        verify(connectivityService).markOffline("STATION-RECONNECT");
    }

    @Test
    void shouldIgnoreClosedSessionWithoutStationId() {
        var unauthenticatedSession = org.mockito.Mockito.mock(WebSocketSession.class);
        when(unauthenticatedSession.getAttributes()).thenReturn(new HashMap<>());
        when(shutdownState.isShuttingDown()).thenReturn(false);

        handler.afterConnectionClosed(unauthenticatedSession, CloseStatus.NORMAL);

        verify(connectivityService, never()).markOffline(org.mockito.ArgumentMatchers.anyString());
    }
}
