package com.voltgrid.station.api.ocpp;

import com.voltgrid.station.application.StationConnectivityService;
import com.voltgrid.station.application.security.OcppSessionFencer;
import com.voltgrid.station.application.security.StationCredentialService;
import org.springframework.beans.factory.annotation.Autowired;
import com.voltgrid.station.infrastructure.lifecycle.ApplicationShutdownState;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.SubProtocolCapable;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class OcppWebSocketHandler
        extends TextWebSocketHandler
        implements SubProtocolCapable, OcppSessionFencer {

    public static final String SUBPROTOCOL = "ocpp2.0.1";

    private final OcppMessageProcessor messageProcessor;
    private final StationConnectivityService connectivityService;
    private final ApplicationShutdownState shutdownState;
    private final StationCredentialService credentialService;
    private final ConcurrentHashMap<String, WebSocketSession> activeSessionMap =
            new ConcurrentHashMap<>();

    @Autowired
    public OcppWebSocketHandler(
            OcppMessageProcessor messageProcessor,
            StationConnectivityService connectivityService,
            ApplicationShutdownState shutdownState,
            StationCredentialService credentialService
    ) {
        this.messageProcessor = messageProcessor;
        this.connectivityService = connectivityService;
        this.shutdownState = shutdownState;
        this.credentialService = credentialService;
    }

    OcppWebSocketHandler(
            OcppMessageProcessor messageProcessor,
            StationConnectivityService connectivityService,
            ApplicationShutdownState shutdownState
    ) {
        this(messageProcessor, connectivityService, shutdownState, null);
    }

    @Override
    public List<String> getSubProtocols() {
        return List.of(SUBPROTOCOL);
    }

    @Override
    public void afterConnectionEstablished(
            WebSocketSession session
    ) throws Exception {
        super.afterConnectionEstablished(session);

        var stationId = (String) session
                .getAttributes()
                .get(OcppHandshakeInterceptor.STATION_ID_ATTRIBUTE);

        if (stationId != null) {
            var oldSession = activeSessionMap.put(stationId, session);
            if (oldSession != null && oldSession != session && oldSession.isOpen()) {
                try {
                    oldSession.close(CloseStatus.POLICY_VIOLATION.withReason("Superseded by new connection"));
                } catch (Exception ignored) {}
            }
        }
    }

    @Override
    public void terminateSession(String stationId, String reason) {
        if (stationId == null) {
            return;
        }
        WebSocketSession session = activeSessionMap.get(stationId);
        if (session != null && session.isOpen()) {
            try {
                session.close(CloseStatus.POLICY_VIOLATION.withReason(reason));
            } catch (Exception ignored) {}
        }
    }

    @Override
    protected void handleTextMessage(
            WebSocketSession session,
            TextMessage message
    ) throws Exception {

        var stationId = (String) session
                .getAttributes()
                .get(OcppHandshakeInterceptor.STATION_ID_ATTRIBUTE);

        if (stationId == null || activeSessionMap.get(stationId) != session) {
            session.close(CloseStatus.POLICY_VIOLATION.withReason("Session is no longer active"));
            return;
        }

        var credentialId = (String) session.getAttributes().get(OcppHandshakeInterceptor.CREDENTIAL_ID_ATTRIBUTE);
        if (credentialId != null && (credentialService == null || !credentialService.isCredentialActive(stationId, credentialId))) {
            session.close(CloseStatus.POLICY_VIOLATION.withReason("Station credential is no longer active"));
            return;
        }

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
        if (shutdownState.isShuttingDown()) {
            return;
        }

        var stationId = (String) session
                .getAttributes()
                .get(OcppHandshakeInterceptor.STATION_ID_ATTRIBUTE);

        if (stationId != null) {
            activeSessionMap.computeIfPresent(stationId, (id, current) -> {
                if (current != session) return current;
                connectivityService.markOffline(id);
                return null;
            });
        }
    }
}
