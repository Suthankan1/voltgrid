package com.voltgrid.station.api.ocpp;

import com.voltgrid.station.application.StationReader;
import com.voltgrid.station.application.security.StationCredentialService;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Base64;
import java.util.Map;

@Component
public class OcppHandshakeInterceptor implements HandshakeInterceptor {

    public static final String STATION_ID_ATTRIBUTE = "stationId";
    public static final String CREDENTIAL_ID_ATTRIBUTE = "stationCredentialId";

    private final StationReader stationReader;
    private final StationCredentialService credentialService;
    private final boolean authRequired;
    private final boolean requireSecureTransport;
    private MeterRegistry meterRegistry;

    @Autowired(required = false)
    public void setMeterRegistry(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }

    private void recordFailure(String reason) {
        if (meterRegistry != null) {
            meterRegistry.counter("voltgrid.ocpp.handshake_failures", "reason", reason).increment();
        }
    }

    @Autowired
    public OcppHandshakeInterceptor(
            StationReader stationReader,
            StationCredentialService credentialService,
            @Value("${voltgrid.ocpp.auth-required:true}") boolean authRequired,
            @Value("${voltgrid.ocpp.require-secure-transport:false}") boolean requireSecureTransport
    ) {
        this.stationReader = stationReader;
        this.credentialService = credentialService;
        this.authRequired = authRequired;
        this.requireSecureTransport = requireSecureTransport;
    }

    public OcppHandshakeInterceptor(StationReader stationReader) {
        this(stationReader, null, false, false);
    }

    public OcppHandshakeInterceptor(StationReader stationReader, boolean authRequired) {
        this(stationReader, null, authRequired, false);
    }

    public OcppHandshakeInterceptor(StationReader stationReader, StationCredentialService credentialService) {
        this(stationReader, credentialService, true, false);
    }

    public OcppHandshakeInterceptor(
            StationReader stationReader,
            StationCredentialService credentialService,
            boolean authRequired
    ) {
        this(stationReader, credentialService, authRequired, false);
    }

    @Override
    public boolean beforeHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Map<String, Object> attributes
    ) {
        if (requireSecureTransport && !isSecureTransport(request)) {
            recordFailure("insecure_transport");
            response.setStatusCode(HttpStatus.FORBIDDEN);
            return false;
        }

        if (!supportsOcpp201(request)) {
            recordFailure("invalid_subprotocol");
            response.setStatusCode(HttpStatus.BAD_REQUEST);
            return false;
        }

        var stationId = extractStationId(request);

        if (stationId == null) {
            recordFailure("not_found");
            response.setStatusCode(HttpStatus.NOT_FOUND);
            return false;
        }
        var station = stationReader.findById(stationId).orElse(null);
        if (station == null) {
            recordFailure("not_found");
            response.setStatusCode(HttpStatus.NOT_FOUND);
            return false;
        }

        boolean mapped = station.organizationId() != null && !station.organizationId().isBlank();
        if ((authRequired && !mapped) || !authenticateStation(request, stationId, attributes)) {
            recordFailure("unauthorized");
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            if (response.getHeaders() != null) {
                response.getHeaders().set("WWW-Authenticate", "Basic realm=\"VoltGrid CSMS\"");
            }
            return false;
        }

        attributes.put(STATION_ID_ATTRIBUTE, stationId);
        return true;
    }

    @Override
    public void afterHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Exception exception
    ) {
    }

    private boolean authenticateStation(ServerHttpRequest request, String stationId, Map<String, Object> attributes) {
        var authHeaders = request.getHeaders().get("Authorization");

        if (authHeaders == null || authHeaders.isEmpty()) {
            return !authRequired;
        }

        var authHeader = authHeaders.get(0).trim();

        if (authHeaders.size() == 1 && authHeader.startsWith("Basic ") && authHeader.length() <= 4096) {
            try {
                var base64Credentials = authHeader.substring(6).trim();
                var credentials = new String(
                        Base64.getDecoder().decode(base64Credentials),
                        StandardCharsets.UTF_8
                );
                var parts = credentials.split(":", 2);
                if (parts.length != 2) {
                    return false;
                }
                var username = parts[0];
                var password = parts[1];

                if (!stationId.equals(username)) {
                    return false;
                }

                if (credentialService == null) return false;
                var credential = credentialService.authenticateCredential(stationId, password);
                credential.ifPresent(id -> attributes.put(CREDENTIAL_ID_ATTRIBUTE, id));
                return credential.isPresent();
            } catch (IllegalArgumentException e) {
                return false;
            }
        }

        return false;
    }

    private boolean supportsOcpp201(ServerHttpRequest request) {
        return request.getHeaders()
                .getOrEmpty("Sec-WebSocket-Protocol")
                .stream()
                .flatMap(value -> Arrays.stream(value.split(",")))
                .map(String::trim)
                .anyMatch(OcppWebSocketHandler.SUBPROTOCOL::equals);
    }

    private String extractStationId(ServerHttpRequest request) {
        var path = request.getURI().getPath();
        var prefix = "/ocpp/";

        if (!path.startsWith(prefix)) {
            return null;
        }

        var stationId = path.substring(prefix.length());

        if (stationId.isBlank() || stationId.contains("/")) {
            return null;
        }

        return stationId;
    }

    private boolean isSecureTransport(ServerHttpRequest request) {
        var protoHeaders = request.getHeaders().get("X-Forwarded-Proto");
        if (protoHeaders != null && !protoHeaders.isEmpty()) {
            var proto = protoHeaders.get(0).trim().toLowerCase();
            if (proto.contains(",")) {
                String[] hops = proto.split(",");
                for (String hop : hops) {
                    String cleanHop = hop.trim().toLowerCase();
                    if (!"https".equals(cleanHop) && !"wss".equals(cleanHop)) {
                        return false;
                    }
                }
                return true;
            }
            return "https".equals(proto) || "wss".equals(proto);
        }

        var scheme = request.getURI().getScheme();
        return scheme != null && ("https".equalsIgnoreCase(scheme) || "wss".equalsIgnoreCase(scheme));
    }
}
