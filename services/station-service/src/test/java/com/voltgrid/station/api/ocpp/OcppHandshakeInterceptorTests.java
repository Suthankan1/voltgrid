package com.voltgrid.station.api.ocpp;

import com.voltgrid.station.application.StationConnectivityService;
import com.voltgrid.station.application.StationReader;
import com.voltgrid.station.domain.ChargingStation;
import com.voltgrid.station.domain.StationStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

import java.util.Map;

import java.net.URI;
import java.util.HashMap;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OcppHandshakeInterceptorTests {

    @Mock
    private StationReader stationReader;

    @Mock
    private ServerHttpRequest request;

    @Mock
    private ServerHttpResponse response;

    @Mock
    private WebSocketHandler handler;

    @Mock
    private OcppMessageProcessor messageProcessor;

    @Mock
    private StationConnectivityService connectivityService;

    private OcppHandshakeInterceptor interceptor;

    @BeforeEach
    void setUp() {
        interceptor = new OcppHandshakeInterceptor(stationReader);
    }

    @Test
    void shouldAcceptKnownStationUsingOcpp201() {
        var headers = new HttpHeaders();

        headers.add(
                "Sec-WebSocket-Protocol",
                OcppWebSocketHandler.SUBPROTOCOL
        );

        when(request.getHeaders()).thenReturn(headers);

        when(request.getURI())
                .thenReturn(
                        URI.create(
                                "ws://localhost:8080/ocpp/STATION-003"
                        )
                );

        when(stationReader.findById("STATION-003"))
                .thenReturn(
                        Optional.of(
                                new ChargingStation(
                                        "STATION-003",
                                        "Galle Central",
                                        StationStatus.OFFLINE
                                )
                        )
                );

        var attributes = new HashMap<String, Object>();

        var accepted = interceptor.beforeHandshake(
                request,
                response,
                handler,
                attributes
        );

        assertThat(accepted).isTrue();

        assertThat(attributes)
                .containsEntry(
                        OcppHandshakeInterceptor.STATION_ID_ATTRIBUTE,
                        "STATION-003"
                );
    }

    @Test
    void shouldRejectUnsupportedOcppProtocol() {
        var headers = new HttpHeaders();

        headers.add(
                "Sec-WebSocket-Protocol",
                "ocpp1.6"
        );

        when(request.getHeaders()).thenReturn(headers);

        var accepted = interceptor.beforeHandshake(
                request,
                response,
                handler,
                new HashMap<>()
        );

        assertThat(accepted).isFalse();

        verify(response)
                .setStatusCode(HttpStatus.BAD_REQUEST);

        verifyNoInteractions(stationReader);
    }

    @Test
    void shouldRejectUnknownStation() {
        var headers = new HttpHeaders();

        headers.add(
                "Sec-WebSocket-Protocol",
                OcppWebSocketHandler.SUBPROTOCOL
        );

        when(request.getHeaders()).thenReturn(headers);

        when(request.getURI())
                .thenReturn(
                        URI.create(
                                "ws://localhost:8080/ocpp/UNKNOWN"
                        )
                );

        when(stationReader.findById("UNKNOWN"))
                .thenReturn(Optional.empty());

        var accepted = interceptor.beforeHandshake(
                request,
                response,
                handler,
                new HashMap<>()
        );

        assertThat(accepted).isFalse();

        verify(response)
                .setStatusCode(HttpStatus.NOT_FOUND);
    }

    @Test
    void shouldSupportOcpp201Subprotocol() {
        var websocketHandler =
                new OcppWebSocketHandler(
                        messageProcessor,
                        connectivityService
                );

        assertThat(websocketHandler.getSubProtocols())
                .containsExactly("ocpp2.0.1");
    }

    @Test
    void shouldMarkStationOfflineWhenWebSocketCloses()
            throws Exception {

        var session = mock(WebSocketSession.class);

        when(session.getAttributes())
                .thenReturn(Map.of(
                        OcppHandshakeInterceptor.STATION_ID_ATTRIBUTE,
                        "STATION-003"
                ));

        var websocketHandler = new OcppWebSocketHandler(
                messageProcessor,
                connectivityService
        );

        websocketHandler.afterConnectionClosed(
                session,
                CloseStatus.NORMAL
        );

        verify(connectivityService)
                .markOffline("STATION-003");
    }
}