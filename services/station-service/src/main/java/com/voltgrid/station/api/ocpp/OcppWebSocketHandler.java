package com.voltgrid.station.api.ocpp;

import com.voltgrid.station.application.StationConnectivityService;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.SubProtocolCapable;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.List;

@Component
public class OcppWebSocketHandler
        extends TextWebSocketHandler
        implements SubProtocolCapable {

    public static final String SUBPROTOCOL = "ocpp2.0.1";

    private final OcppMessageProcessor messageProcessor;
    private final StationConnectivityService connectivityService;

    public OcppWebSocketHandler(
            OcppMessageProcessor messageProcessor,
            StationConnectivityService connectivityService
    ) {
        this.messageProcessor = messageProcessor;
        this.connectivityService = connectivityService;
    }

    @Override
    public List<String> getSubProtocols() {
        return List.of(SUBPROTOCOL);
    }

    @Override
    protected void handleTextMessage(
            WebSocketSession session,
            TextMessage message
    ) throws Exception {

        var stationId = (String) session
                .getAttributes()
                .get(OcppHandshakeInterceptor.STATION_ID_ATTRIBUTE);

        try {
            var response = messageProcessor.process(
                    stationId,
                    message.getPayload()
            );

            session.sendMessage(
                    new TextMessage(response)
            );

        } catch (IllegalArgumentException exception) {
            session.close(
                    CloseStatus.BAD_DATA
                            .withReason("Invalid OCPP frame")
            );
        }
    }

    @Override
    public void afterConnectionClosed(
            WebSocketSession session,
            CloseStatus status
    ) {
        var stationId = (String) session
                .getAttributes()
                .get(OcppHandshakeInterceptor.STATION_ID_ATTRIBUTE);

        if (stationId != null) {
            connectivityService.markOffline(stationId);
        }
    }
}