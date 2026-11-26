package com.voltgrid.station.api.ocpp;

import com.voltgrid.station.application.StationReader;
import com.voltgrid.station.application.security.StationCredentialService;
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

    @Autowired
    public OcppHandshakeInterceptor(
            StationReader stationReader,
            StationCredentialService credentialService,
            @Value("${voltgrid.ocpp.auth-required:true}") boolean authRequired
    ) {
        this.stationReader = stationReader;
        this.credentialService = credentialService;
        this.authRequired = authRequired;
    }

    public OcppHandshakeInterceptor(StationReader stationReader) {
        this(stationReader, null, false);
    }

    public OcppHandshakeInterceptor(StationReader stationReader, boolean authRequired) {
        this(stationReader, null, authRequired);
    }

    public OcppHandshakeInterceptor(StationReader stationReader, StationCredentialService credentialService) {
        this(stationReader, credentialService, true);
    }

    @Override
    public boolean beforeHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Map<String, Object> attributes
    ) {
        if (!supportsOcpp201(request)) {
            response.setStatusCode(HttpStatus.BAD_REQUEST);
            return false;
        }

        var stationId = extractStationId(request);

        if (stationId == null || stationReader.findById(stationId).isEmpty()) {
            response.setStatusCode(HttpStatus.NOT_FOUND);
            return false;
        }

        if (!authenticateStation(request, stationId, attributes)) {
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
}
