package com.voltgrid.station.api.ocpp;

import com.voltgrid.station.application.StationReader;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Arrays;
import java.util.Map;

@Component
public class OcppHandshakeInterceptor implements HandshakeInterceptor {

    public static final String STATION_ID_ATTRIBUTE = "stationId";

    private final StationReader stationReader;

    public OcppHandshakeInterceptor(StationReader stationReader) {
        this.stationReader = stationReader;
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