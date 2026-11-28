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
import org.springframework.mock.env.MockEnvironment;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.socket.WebSocketHandler;

import java.net.InetSocketAddress;
import java.net.URI;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OcppHandshakeTransportSecurityTests {

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

    private HttpHeaders headers;
    private Map<String, Object> attributes;

    @BeforeEach
    void setUp() {
        headers = new HttpHeaders();
        attributes = new HashMap<>();
        org.mockito.Mockito.lenient().when(request.getHeaders()).thenReturn(headers);
    }

    @Test
    void rejectsPlaintextHttpWhenSecureTransportRequired() {
        var interceptor = new OcppHandshakeInterceptor(stationReader, credentialService, true, true);
        when(request.getURI()).thenReturn(URI.create("http://localhost:8080/ocpp/CS001"));

        boolean allowed = interceptor.beforeHandshake(request, response, wsHandler, attributes);

        assertThat(allowed).isFalse();
        verify(response).setStatusCode(HttpStatus.FORBIDDEN);
    }

    @Test
    void rejectsPlaintextWsWhenSecureTransportRequired() {
        var interceptor = new OcppHandshakeInterceptor(stationReader, credentialService, true, true);
        when(request.getURI()).thenReturn(URI.create("ws://localhost:8080/ocpp/CS001"));

        boolean allowed = interceptor.beforeHandshake(request, response, wsHandler, attributes);

        assertThat(allowed).isFalse();
        verify(response).setStatusCode(HttpStatus.FORBIDDEN);
    }

    @Test
    void rejectsRogueForwardedProtoHttp() {
        var interceptor = new OcppHandshakeInterceptor(stationReader, credentialService, true, true, "192.0.2.0/28");
        when(request.getRemoteAddress()).thenReturn(new InetSocketAddress("192.0.2.6", 443));
        when(request.getURI()).thenReturn(URI.create("http://station-service:8080/ocpp/CS001"));
        headers.set("X-Forwarded-Proto", "http");

        boolean allowed = interceptor.beforeHandshake(request, response, wsHandler, attributes);

        assertThat(allowed).isFalse();
        verify(response).setStatusCode(HttpStatus.FORBIDDEN);
    }

    @Test
    void rejectsMultiHopWithInsecureProto() {
        var interceptor = new OcppHandshakeInterceptor(stationReader, credentialService, true, true, "192.0.2.0/28");
        when(request.getRemoteAddress()).thenReturn(new InetSocketAddress("192.0.2.6", 443));
        when(request.getURI()).thenReturn(URI.create("http://station-service:8080/ocpp/CS001"));
        headers.set("X-Forwarded-Proto", "http, https");

        boolean allowed = interceptor.beforeHandshake(request, response, wsHandler, attributes);

        assertThat(allowed).isFalse();
        verify(response).setStatusCode(HttpStatus.FORBIDDEN);
    }

    @Test
    void allowsDirectHttpsWhenSecureTransportRequired() {
        var interceptor = new OcppHandshakeInterceptor(stationReader, credentialService, true, true);
        when(request.getURI()).thenReturn(URI.create("https://localhost:8443/ocpp/CS001"));
        headers.set("Sec-WebSocket-Protocol", "ocpp2.0.1");
        headers.set("Authorization", "Basic Q1MwMDE6c2VjcmV0");

        var station = new ChargingStation(
                "CS001", "Station 1", StationStatus.ONLINE, Instant.now(), "org-1", "site-1"
        );
        when(stationReader.findById("CS001")).thenReturn(Optional.of(station));
        when(credentialService.authenticateCredential("CS001", "secret")).thenReturn(Optional.of("cred-uuid-1"));

        boolean allowed = interceptor.beforeHandshake(request, response, wsHandler, attributes);

        assertThat(allowed).isTrue();
        assertThat(attributes.get(OcppHandshakeInterceptor.STATION_ID_ATTRIBUTE)).isEqualTo("CS001");
    }

    @Test
    void allowsXForwardedProtoHttpsWhenBehindTlsTerminatingProxy() {
        var interceptor = new OcppHandshakeInterceptor(stationReader, credentialService, true, true, "192.0.2.0/28");
        when(request.getRemoteAddress()).thenReturn(new InetSocketAddress("192.0.2.6", 443));
        headers.set("X-Forwarded-Proto", "https");
        headers.set("Sec-WebSocket-Protocol", "ocpp2.0.1");
        headers.set("Authorization", "Basic Q1MwMDE6c2VjcmV0");
        when(request.getURI()).thenReturn(URI.create("http://station-service:8080/ocpp/CS001"));

        var station = new ChargingStation(
                "CS001", "Station 1", StationStatus.ONLINE, Instant.now(), "org-1", "site-1"
        );
        when(stationReader.findById("CS001")).thenReturn(Optional.of(station));
        when(credentialService.authenticateCredential("CS001", "secret")).thenReturn(Optional.of("cred-uuid-1"));

        boolean allowed = interceptor.beforeHandshake(request, response, wsHandler, attributes);

        assertThat(allowed).isTrue();
        assertThat(attributes.get(OcppHandshakeInterceptor.STATION_ID_ATTRIBUTE)).isEqualTo("CS001");
    }

    @Test
    void allowsXForwardedProtoWss() {
        var interceptor = new OcppHandshakeInterceptor(stationReader, credentialService, true, true, "192.0.2.0/28");
        when(request.getRemoteAddress()).thenReturn(new InetSocketAddress("192.0.2.6", 443));
        headers.set("X-Forwarded-Proto", "wss");
        headers.set("Sec-WebSocket-Protocol", "ocpp2.0.1");
        headers.set("Authorization", "Basic Q1MwMDE6c2VjcmV0");
        when(request.getURI()).thenReturn(URI.create("http://station-service:8080/ocpp/CS001"));

        var station = new ChargingStation(
                "CS001", "Station 1", StationStatus.ONLINE, Instant.now(), "org-1", "site-1"
        );
        when(stationReader.findById("CS001")).thenReturn(Optional.of(station));
        when(credentialService.authenticateCredential("CS001", "secret")).thenReturn(Optional.of("cred-uuid-1"));

        boolean allowed = interceptor.beforeHandshake(request, response, wsHandler, attributes);

        assertThat(allowed).isTrue();
    }

    @Test
    void requiresSecureTransportByDefaultInProduction() {
        var environment = new MockEnvironment();
        environment.setActiveProfiles("production");
        var interceptor = new OcppHandshakeInterceptor(stationReader, credentialService, environment);
        when(request.getURI()).thenReturn(URI.create("http://station-service:8080/ocpp/CS001"));

        assertThat(interceptor.beforeHandshake(request, response, wsHandler, attributes)).isFalse();
        verify(response).setStatusCode(HttpStatus.FORBIDDEN);
    }

    @Test
    void ignoresProxyProtocolMetadataFromOutsideTheConfiguredNetwork() {
        var interceptor = new OcppHandshakeInterceptor(
                stationReader, credentialService, true, true, "192.0.2.0/28");
        when(request.getURI()).thenReturn(URI.create("http://station-service:8080/ocpp/CS001"));
        when(request.getRemoteAddress()).thenReturn(new InetSocketAddress("192.0.2.16", 443));
        headers.set("X-Forwarded-Proto", "https");

        assertThat(interceptor.beforeHandshake(request, response, wsHandler, attributes)).isFalse();
        verify(response).setStatusCode(HttpStatus.FORBIDDEN);
    }

    @Test
    void rejectsFrameworkForwardingWhenProductionRequiresNativePeerIdentity() {
        var environment = new MockEnvironment().withProperty("server.forward-headers-strategy", "framework");
        environment.setActiveProfiles("prod");

        assertThatThrownBy(() -> new OcppHandshakeInterceptor(stationReader, credentialService, environment))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void allowsPlaintextWhenSecureTransportNotRequiredInDevMode() {
        var interceptor = new OcppHandshakeInterceptor(stationReader, credentialService, false, false);
        when(request.getURI()).thenReturn(URI.create("http://localhost:8080/ocpp/CS001"));
        headers.set("Sec-WebSocket-Protocol", "ocpp2.0.1");

        var station = new ChargingStation(
                "CS001", "Station 1", StationStatus.ONLINE, Instant.now(), "org-1", "site-1"
        );
        when(stationReader.findById("CS001")).thenReturn(Optional.of(station));

        boolean allowed = interceptor.beforeHandshake(request, response, wsHandler, attributes);

        assertThat(allowed).isTrue();
    }
}
