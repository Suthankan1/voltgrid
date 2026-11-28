package com.voltgrid.station.api.ocpp;

import com.voltgrid.station.application.StationConnectivityService;
import com.voltgrid.station.application.security.OcppSessionFencer;
import com.voltgrid.station.application.security.StationCredentialService;
import com.voltgrid.station.infrastructure.lifecycle.ApplicationShutdownState;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.SubProtocolCapable;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class OcppWebSocketHandler
        extends TextWebSocketHandler
        implements SubProtocolCapable, OcppSessionFencer, com.voltgrid.station.application.OcppCommandSender {

    public static final String SUBPROTOCOL = "ocpp2.0.1";
    public static final String CONNECTION_GENERATION_ATTRIBUTE = "voltgrid.ocpp.connection-generation";

    private final OcppMessageProcessor messageProcessor;
    private final StationConnectivityService connectivityService;
    private final ApplicationShutdownState shutdownState;
    private final StationCredentialService credentialService;
    private final tools.jackson.databind.json.JsonMapper jsonMapper;
    private final ConcurrentHashMap<String, WebSocketSession> activeSessionMap =
            new ConcurrentHashMap<>();
    private MeterRegistry meterRegistry;
    private com.voltgrid.station.application.StationCommandService commandService;

    @Autowired(required = false)
    public void setCommandService(com.voltgrid.station.application.StationCommandService commandService) {
        this.commandService = commandService;
    }

    @Autowired(required = false)
    public void setMeterRegistry(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
        if (meterRegistry != null) {
            Gauge.builder("voltgrid.ocpp.active_connections", activeSessionMap, ConcurrentHashMap::size)
                    .description("Active connected OCPP charging station WebSocket sessions")
                    .register(meterRegistry);
        }
    }

    @Autowired
    public OcppWebSocketHandler(
            OcppMessageProcessor messageProcessor,
            StationConnectivityService connectivityService,
            ApplicationShutdownState shutdownState,
            @Autowired(required = false) StationCredentialService credentialService,
            @Autowired(required = false) tools.jackson.databind.json.JsonMapper jsonMapper
    ) {
        this.messageProcessor = messageProcessor;
        this.connectivityService = connectivityService;
        this.shutdownState = shutdownState;
        this.credentialService = credentialService;
        this.jsonMapper = jsonMapper != null ? jsonMapper : tools.jackson.databind.json.JsonMapper.builder().build();
    }

    OcppWebSocketHandler(
            OcppMessageProcessor messageProcessor,
            StationConnectivityService connectivityService,
            ApplicationShutdownState shutdownState,
            StationCredentialService credentialService
    ) {
        this(messageProcessor, connectivityService, shutdownState, credentialService, null);
    }

    OcppWebSocketHandler(
            OcppMessageProcessor messageProcessor,
            StationConnectivityService connectivityService,
            ApplicationShutdownState shutdownState
    ) {
        this(messageProcessor, connectivityService, shutdownState, null, null);
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
            long generation = connectivityService.registerConnection(stationId, Instant.now());
            session.getAttributes().put(CONNECTION_GENERATION_ATTRIBUTE, generation);

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

        Long generation = (Long) session
                .getAttributes()
                .get(CONNECTION_GENERATION_ATTRIBUTE);

        if (generation != null && !connectivityService.isGenerationActive(stationId, generation)) {
            session.close(CloseStatus.POLICY_VIOLATION.withReason("Superseded by newer connection generation"));
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

            if (meterRegistry != null) {
                meterRegistry.counter("voltgrid.ocpp.messages.received", "status", "success").increment();
            }

            if (response != null) {
                session.sendMessage(
                        new TextMessage(response)
                );
            }

        } catch (IllegalArgumentException exception) {
            if (meterRegistry != null) {
                meterRegistry.counter("voltgrid.ocpp.messages.received", "status", "invalid_frame").increment();
            }
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

        if (stationId == null || !activeSessionMap.remove(stationId, session)) {
            return;
        }

        Long generation = (Long) session.getAttributes().get(CONNECTION_GENERATION_ATTRIBUTE);
        Runnable onActiveDisconnect = () -> {
            if (commandService != null) {
                commandService.handleStationDisconnect(stationId);
            }
        };

        if (generation != null && generation > 0) {
            connectivityService.markOfflineIfGenerationMatches(stationId, generation, onActiveDisconnect);
        } else {
            connectivityService.markOffline(stationId);
            onActiveDisconnect.run();
        }
    }

    @Override
    public boolean sendCall(String stationId, String messageId, String action, String payloadJson) {
        if (stationId == null) {
            return false;
        }
        WebSocketSession session = activeSessionMap.get(stationId);
        if (session == null || !session.isOpen()) {
            return false;
        }
        try {
            var callArray = jsonMapper.createArrayNode();
            callArray.add(2); // CALL
            callArray.add(messageId);
            callArray.add(action);
            callArray.add(jsonMapper.readTree(payloadJson));
            session.sendMessage(new TextMessage(jsonMapper.writeValueAsString(callArray)));
            return true;
        } catch (Exception ex) {
            return false;
        }
    }

    @Override
    public boolean isStationConnected(String stationId) {
        if (stationId == null) {
            return false;
        }
        WebSocketSession session = activeSessionMap.get(stationId);
        return session != null && session.isOpen();
    }
}
