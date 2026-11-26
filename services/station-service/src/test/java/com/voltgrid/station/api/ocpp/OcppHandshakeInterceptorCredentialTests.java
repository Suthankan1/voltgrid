package com.voltgrid.station.api.ocpp;

import com.voltgrid.station.application.StationReader;
import com.voltgrid.station.application.security.StationCredentialService;
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

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OcppHandshakeInterceptorCredentialTests {

    @Mock
    private StationReader stationReader;

    @Mock
    private StationCredentialService credentialService;

    @Mock
    private ServerHttpRequest request;

    @Mock
    private ServerHttpResponse response;

    @Mock
    private WebSocketHandler wsHandler;

    private OcppHandshakeInterceptor interceptor;
    private HttpHeaders headers;
    private HttpHeaders responseHeaders;
    private Map<String, Object> attributes;

    @BeforeEach
    void setUp() {
        interceptor = new OcppHandshakeInterceptor(stationReader, credentialService, true);
        headers = new HttpHeaders();
        responseHeaders = new HttpHeaders();
        attributes = new HashMap<>();

        when(request.getHeaders()).thenReturn(headers);
        when(request.getURI()).thenReturn(URI.create("http://localhost:8080/ocpp/STA-001"));
        headers.put("Sec-WebSocket-Protocol", List.of("ocpp2.0.1"));
    }

    private void setBasicAuth(String username, String password) {
        String token = Base64.getEncoder().encodeToString((username + ":" + password).getBytes(StandardCharsets.UTF_8));
        headers.set("Authorization", "Basic " + token);
    }

    @Test
    void shouldAcceptValidCredentialAndBindStationIdAttribute() {
        when(stationReader.findById("STA-001")).thenReturn(Optional.of(
                new ChargingStation("STA-001", "Station 1", StationStatus.OFFLINE)
        ));
        setBasicAuth("STA-001", "CorrectPassword123!");
        when(credentialService.authenticateCredential("STA-001", "CorrectPassword123!")).thenReturn(Optional.of("cred-1"));

        boolean allowed = interceptor.beforeHandshake(request, response, wsHandler, attributes);

        assertThat(allowed).isTrue();
        assertThat(attributes.get(OcppHandshakeInterceptor.STATION_ID_ATTRIBUTE)).isEqualTo("STA-001");
        verify(response, never()).setStatusCode(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void shouldRejectWhenMissingAuthorizationHeader() {
        when(stationReader.findById("STA-001")).thenReturn(Optional.of(
                new ChargingStation("STA-001", "Station 1", StationStatus.OFFLINE)
        ));
        when(response.getHeaders()).thenReturn(responseHeaders);

        boolean allowed = interceptor.beforeHandshake(request, response, wsHandler, attributes);

        assertThat(allowed).isFalse();
        verify(response).setStatusCode(HttpStatus.UNAUTHORIZED);
        assertThat(responseHeaders.getFirst("WWW-Authenticate")).contains("Basic realm=");
    }

    @Test
    void shouldRejectWhenPasswordIsIncorrect() {
        when(stationReader.findById("STA-001")).thenReturn(Optional.of(
                new ChargingStation("STA-001", "Station 1", StationStatus.OFFLINE)
        ));
        when(response.getHeaders()).thenReturn(responseHeaders);
        setBasicAuth("STA-001", "WrongPassword!");
        when(credentialService.authenticateCredential("STA-001", "WrongPassword!")).thenReturn(Optional.empty());

        boolean allowed = interceptor.beforeHandshake(request, response, wsHandler, attributes);

        assertThat(allowed).isFalse();
        verify(response).setStatusCode(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void shouldRejectWhenStationIdInCredentialMismatchesPath() {
        when(stationReader.findById("STA-001")).thenReturn(Optional.of(
                new ChargingStation("STA-001", "Station 1", StationStatus.OFFLINE)
        ));
        when(response.getHeaders()).thenReturn(responseHeaders);
        // Attacker attempts to connect to /ocpp/STA-001 using STA-002 credentials
        setBasicAuth("STA-002", "SomePassword!");

        boolean allowed = interceptor.beforeHandshake(request, response, wsHandler, attributes);

        assertThat(allowed).isFalse();
        verify(response).setStatusCode(HttpStatus.UNAUTHORIZED);
        verify(credentialService, never()).authenticateCredential(any(), any());
    }

    @Test
    void shouldRejectUnknownStationWith404BeforeAuthentication() {
        when(stationReader.findById("STA-001")).thenReturn(Optional.empty());

        boolean allowed = interceptor.beforeHandshake(request, response, wsHandler, attributes);

        assertThat(allowed).isFalse();
        verify(response).setStatusCode(HttpStatus.NOT_FOUND);
        verify(credentialService, never()).authenticateCredential(any(), any());
    }
}
