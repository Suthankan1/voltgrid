package com.voltgrid.station.api.ocpp;

import com.voltgrid.station.application.StationReader;
import com.voltgrid.station.application.security.StationCredentialService;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.math.BigInteger;
import java.net.InetAddress;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Map;

@Component
public class OcppHandshakeInterceptor implements HandshakeInterceptor {

    public static final String STATION_ID_ATTRIBUTE = "stationId";
    public static final String CREDENTIAL_ID_ATTRIBUTE = "stationCredentialId";

    private final StationReader stationReader;
    private final StationCredentialService credentialService;
    private final boolean authRequired;
    private final boolean requireSecureTransport;
    private final List<TrustedProxyNetwork> trustedProxies;
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
            Environment environment
    ) {
        this(stationReader, credentialService,
                environment.getProperty("voltgrid.ocpp.auth-required", Boolean.class, true),
                environment.getProperty("voltgrid.ocpp.require-secure-transport", Boolean.class,
                        environment.acceptsProfiles(Profiles.of("prod", "production"))),
                environment.getProperty("voltgrid.ocpp.trusted-proxy-cidrs", ""));
        if (requireSecureTransport
                && !"none".equalsIgnoreCase(environment.getProperty("server.forward-headers-strategy", "none"))) {
            throw new IllegalStateException("Secure OCPP requires native request addresses and schemes");
        }
    }

    public OcppHandshakeInterceptor(
            StationReader stationReader,
            StationCredentialService credentialService,
            boolean authRequired,
            boolean requireSecureTransport
    ) {
        this(stationReader, credentialService, authRequired, requireSecureTransport, "");
    }

    OcppHandshakeInterceptor(
            StationReader stationReader,
            StationCredentialService credentialService,
            boolean authRequired,
            boolean requireSecureTransport,
            String trustedProxyCidrs
    ) {
        this.stationReader = stationReader;
        this.credentialService = credentialService;
        this.authRequired = authRequired;
        this.requireSecureTransport = requireSecureTransport;
        this.trustedProxies = trustedProxyCidrs.isBlank() ? List.of()
                : Arrays.stream(trustedProxyCidrs.split(",", -1)).map(String::trim)
                        .map(TrustedProxyNetwork::parse).toList();
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
        if (isSecureScheme(request.getURI().getScheme())) {
            return true;
        }

        var peer = request.getRemoteAddress();
        if (peer == null || peer.getAddress() == null
                || trustedProxies.stream().noneMatch(network -> network.contains(peer.getAddress()))) {
            return false;
        }

        var forwarded = request.getHeaders().getOrEmpty("X-Forwarded-Proto");
        return forwarded.size() == 1 && isSecureScheme(forwarded.getFirst().trim());
    }

    private static boolean isSecureScheme(String protocol) {
        return "https".equalsIgnoreCase(protocol) || "wss".equalsIgnoreCase(protocol);
    }

    private record TrustedProxyNetwork(BigInteger address, int addressBits, int hostBits) {

        private static TrustedProxyNetwork parse(String cidr) {
            var parts = cidr.split("/", -1);
            if (parts.length != 2) {
                throw new IllegalArgumentException("OCPP trusted proxy settings require CIDR notation");
            }

            byte[] address = InetAddress.ofLiteral(parts[0]).getAddress();
            int addressBits = address.length * Byte.SIZE;
            int prefixLength = Integer.parseInt(parts[1]);
            if (prefixLength < 1 || prefixLength > addressBits) {
                throw new IllegalArgumentException("Invalid OCPP trusted proxy CIDR prefix");
            }
            return new TrustedProxyNetwork(new BigInteger(1, address), addressBits, addressBits - prefixLength);
        }

        private boolean contains(InetAddress peer) {
            byte[] address = peer.getAddress();
            return address.length * Byte.SIZE == addressBits
                    && this.address.xor(new BigInteger(1, address)).bitLength() <= hostBits;
        }
    }
}
