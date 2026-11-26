package com.voltgrid.station.api.ocpp;

import com.voltgrid.station.application.StationReader;
import com.voltgrid.station.domain.ChargingStation;
import com.voltgrid.station.domain.StationStatus;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.socket.WebSocketHandler;

import java.net.URI;
import java.util.HashMap;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OcppHandshakeInterceptorAuthTests {

    @Mock
    private StationReader stationReader;

    @Mock
    private ServerHttpRequest request;

    @Mock
    private ServerHttpResponse response;

    @Mock
    private WebSocketHandler wsHandler;

    @Test
    void shouldRejectWhenAuthRequiredAndNoCredentials() {
        var authInterceptor = new OcppHandshakeInterceptor(
                stationReader,
                true // authRequired
        );

        var headers = new HttpHeaders();
        headers.add("Sec-WebSocket-Protocol", OcppWebSocketHandler.SUBPROTOCOL);

        when(request.getHeaders()).thenReturn(headers);
        when(request.getURI()).thenReturn(URI.create("ws://localhost:8080/ocpp/STATION-003"));
        when(stationReader.findById("STATION-003")).thenReturn(
                Optional.of(new ChargingStation("STATION-003", "Galle", StationStatus.OFFLINE))
        );
        when(response.getHeaders()).thenReturn(new HttpHeaders());

        var accepted = authInterceptor.beforeHandshake(request, response, wsHandler, new HashMap<>());

        assertThat(accepted).isFalse();
        verify(response).setStatusCode(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void shouldAcceptWhenValidBasicAuthMatchesStationId() {
        var authInterceptor = new OcppHandshakeInterceptor(
                stationReader,
                true
        );

        var headers = new HttpHeaders();
        headers.add("Sec-WebSocket-Protocol", OcppWebSocketHandler.SUBPROTOCOL);
        // Base64 encoding of "STATION-003:secretPass123" is "U1RBVElPTi0wMDM6c2VjcmV0UGFzczEyMw=="
        headers.add("Authorization", "Basic U1RBVElPTi0wMDM6c2VjcmV0UGFzczEyMw==");

        when(request.getHeaders()).thenReturn(headers);
        when(request.getURI()).thenReturn(URI.create("ws://localhost:8080/ocpp/STATION-003"));
        when(stationReader.findById("STATION-003")).thenReturn(
                Optional.of(new ChargingStation("STATION-003", "Galle", StationStatus.OFFLINE))
        );

        var accepted = authInterceptor.beforeHandshake(request, response, wsHandler, new HashMap<>());

        assertThat(accepted).isFalse();
    }

    @Test
    void shouldRejectWhenBasicAuthMismatchesStationId() {
        var authInterceptor = new OcppHandshakeInterceptor(
                stationReader,
                true
        );

        var headers = new HttpHeaders();
        headers.add("Sec-WebSocket-Protocol", OcppWebSocketHandler.SUBPROTOCOL);
        // Base64 encoding of "OTHER-STATION:secretPass123" is "T1RIRVItU1RBVElPTjpzZWNyZXRQYXNzMTIz"
        headers.add("Authorization", "Basic T1RIRVItU1RBVElPTjpzZWNyZXRQYXNzMTIz");

        when(request.getHeaders()).thenReturn(headers);
        when(request.getURI()).thenReturn(URI.create("ws://localhost:8080/ocpp/STATION-003"));
        when(stationReader.findById("STATION-003")).thenReturn(
                Optional.of(new ChargingStation("STATION-003", "Galle", StationStatus.OFFLINE))
        );
        when(response.getHeaders()).thenReturn(new HttpHeaders());

        var accepted = authInterceptor.beforeHandshake(request, response, wsHandler, new HashMap<>());

        assertThat(accepted).isFalse();
        verify(response).setStatusCode(HttpStatus.UNAUTHORIZED);
    }
}
