package com.voltgrid.station.api.ocpp;

import com.voltgrid.station.application.StationConnectivityService;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;

@Component
public class OcppMessageProcessor {

    private static final int CALL = 2;
    private static final int CALL_RESULT = 3;
    private static final int CALL_ERROR = 4;

    private static final int HEARTBEAT_INTERVAL_SECONDS = 300;

    private final JsonMapper jsonMapper;
    private final StationConnectivityService connectivityService;

    public OcppMessageProcessor(
            JsonMapper jsonMapper,
            StationConnectivityService connectivityService
    ) {
        this.jsonMapper = jsonMapper;
        this.connectivityService = connectivityService;
    }

    public String process(String stationId, String rawMessage) {
        try {
            var message = jsonMapper.readTree(rawMessage);

            validateCall(message);

            var messageId = message.get(1).stringValue();
            var action = message.get(2).stringValue();

            return switch (action) {
                case "BootNotification" ->
                        handleBootNotification(
                                stationId,
                                messageId,
                                message.get(3)
                        );

                case "Heartbeat" ->
                        handleHeartbeat(messageId);

                default ->
                        callError(
                                messageId,
                                "NotImplemented",
                                "Action not implemented: " + action
                        );
            };

        } catch (JacksonException exception) {
            throw new IllegalArgumentException(
                    "Invalid OCPP JSON",
                    exception
            );
        }
    }

    private String handleBootNotification(
            String stationId,
            String messageId,
            JsonNode payload
    ) {
        var request = jsonMapper.treeToValue(
                payload,
                BootNotificationRequest.class
        );

        if (!isValid(request)) {
            return callError(
                    messageId,
                    "FormatViolation",
                    "Invalid BootNotification payload"
            );
        }

        connectivityService.markOnline(stationId);

        var responsePayload = jsonMapper.createObjectNode();

        responsePayload.put(
                "currentTime",
                Instant.now().toString()
        );

        responsePayload.put(
                "interval",
                HEARTBEAT_INTERVAL_SECONDS
        );

        responsePayload.put(
                "status",
                "Accepted"
        );

        var response = jsonMapper.createArrayNode();

        response.add(CALL_RESULT);
        response.add(messageId);
        response.add(responsePayload);

        return jsonMapper.writeValueAsString(response);
    }

    private String handleHeartbeat(String messageId) {
        var responsePayload = jsonMapper.createObjectNode();

        responsePayload.put(
                "currentTime",
                Instant.now().toString()
        );

        var response = jsonMapper.createArrayNode();

        response.add(CALL_RESULT);
        response.add(messageId);
        response.add(responsePayload);

        return jsonMapper.writeValueAsString(response);
    }

    private void validateCall(JsonNode message) {
        if (!message.isArray()
                || message.size() != 4
                || !message.get(0).canConvertToInt()
                || message.get(0).intValue() != CALL
                || !message.get(1).isString()
                || !message.get(2).isString()
                || !message.get(3).isObject()) {

            throw new IllegalArgumentException(
                    "Invalid OCPP CALL frame"
            );
        }
    }

    private boolean isValid(BootNotificationRequest request) {
        return request != null
                && !isBlank(request.reason())
                && request.chargingStation() != null
                && !isBlank(request.chargingStation().model())
                && !isBlank(request.chargingStation().vendorName());
    }

    private String callError(
            String messageId,
            String errorCode,
            String description
    ) {
        var response = jsonMapper.createArrayNode();

        response.add(CALL_ERROR);
        response.add(messageId);
        response.add(errorCode);
        response.add(description);
        response.add(jsonMapper.createObjectNode());

        return jsonMapper.writeValueAsString(response);
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}