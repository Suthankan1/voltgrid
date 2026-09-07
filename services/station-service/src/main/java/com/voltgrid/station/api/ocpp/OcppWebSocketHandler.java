package com.voltgrid.station.api.ocpp;

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

    @Override
    public List<String> getSubProtocols() {
        return List.of(SUBPROTOCOL);
    }

    @Override
    protected void handleTextMessage(
            WebSocketSession session,
            TextMessage message
    ) throws Exception {
        session.close(
                CloseStatus.NOT_ACCEPTABLE
                        .withReason("OCPP message handling not implemented yet")
        );
    }
}