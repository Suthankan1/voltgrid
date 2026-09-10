package com.voltgrid.station.api.ocpp;

import com.voltgrid.station.application.AuthorizationClient;
import com.voltgrid.station.application.AuthorizationOutcome;
import com.voltgrid.station.application.AuthorizationReasonCode;
import com.voltgrid.station.application.ConflictingTransactionEventException;
import com.voltgrid.station.application.InvalidTransactionSequenceException;
import com.voltgrid.station.application.StationConnectivityService;
import com.voltgrid.station.application.StationConnectorStatusService;
import com.voltgrid.station.application.StationTransactionService;
import com.voltgrid.station.application.TransactionNotActiveException;
import com.voltgrid.station.application.TransactionNotFoundException;
import com.voltgrid.station.domain.ConnectorStatus;
import com.voltgrid.station.domain.TransactionMeterSample;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Component
public class OcppMessageProcessor {

    private static final int CALL = 2;
    private static final int CALL_RESULT = 3;
    private static final int CALL_ERROR = 4;

    private static final int HEARTBEAT_INTERVAL_SECONDS = 300;

    private final JsonMapper jsonMapper;
    private final StationConnectivityService connectivityService;
    private final StationConnectorStatusService connectorStatusService;
    private final StationTransactionService transactionService;
    private final AuthorizationClient authorizationClient;

    public OcppMessageProcessor(
            JsonMapper jsonMapper,
            StationConnectivityService connectivityService,
            StationConnectorStatusService connectorStatusService,
            StationTransactionService transactionService,
            AuthorizationClient authorizationClient
    ) {
        this.jsonMapper = jsonMapper;
        this.connectivityService = connectivityService;
        this.connectorStatusService = connectorStatusService;
        this.transactionService = transactionService;
        this.authorizationClient = authorizationClient;
    }

    public String process(
            String stationId,
            String rawMessage
    ) {
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
                        handleHeartbeat(
                                stationId,
                                messageId
                        );

                case "StatusNotification" ->
                        handleStatusNotification(
                                stationId,
                                messageId,
                                message.get(3)
                        );

                case "Authorize" ->
                        handleAuthorize(
                                stationId,
                                messageId,
                                message.get(3)
                        );

                case "TransactionEvent" ->
                        handleTransactionEvent(
                                stationId,
                                messageId,
                                message.get(3)
                        );

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

        var now = Instant.now();

        connectivityService.markOnline(
                stationId,
                now
        );

        var responsePayload =
                jsonMapper.createObjectNode();

        responsePayload.put(
                "currentTime",
                now.toString()
        );

        responsePayload.put(
                "interval",
                HEARTBEAT_INTERVAL_SECONDS
        );

        responsePayload.put(
                "status",
                "Accepted"
        );

        var response =
                jsonMapper.createArrayNode();

        response.add(CALL_RESULT);
        response.add(messageId);
        response.add(responsePayload);

        return jsonMapper.writeValueAsString(
                response
        );
    }

    private String handleHeartbeat(
            String stationId,
            String messageId
    ) {
        var now = Instant.now();

        connectivityService.recordActivity(
                stationId,
                now
        );

        var responsePayload =
                jsonMapper.createObjectNode();

        responsePayload.put(
                "currentTime",
                now.toString()
        );

        var response =
                jsonMapper.createArrayNode();

        response.add(CALL_RESULT);
        response.add(messageId);
        response.add(responsePayload);

        return jsonMapper.writeValueAsString(
                response
        );
    }

    private String handleStatusNotification(
            String stationId,
            String messageId,
            JsonNode payload
    ) {
        var request = jsonMapper.treeToValue(
                payload,
                StatusNotificationRequest.class
        );

        if (!isValid(request)) {
            return callError(
                    messageId,
                    "FormatViolation",
                    "Invalid StatusNotification payload"
            );
        }

        Instant statusUpdatedAt;

        try {
            statusUpdatedAt = Instant.parse(
                    request.timestamp()
            );
        } catch (RuntimeException exception) {
            return callError(
                    messageId,
                    "FormatViolation",
                    "Invalid StatusNotification timestamp"
            );
        }

        var status = toConnectorStatus(
                request.connectorStatus()
        );

        if (status == null) {
            return callError(
                    messageId,
                    "FormatViolation",
                    "Invalid connector status"
            );
        }

        var receivedAt = Instant.now();

        connectorStatusService.updateStatus(
                stationId,
                request.evseId(),
                request.connectorId(),
                status,
                statusUpdatedAt
        );

        connectivityService.recordActivity(
                stationId,
                receivedAt
        );

        var response =
                jsonMapper.createArrayNode();

        response.add(CALL_RESULT);
        response.add(messageId);
        response.add(
                jsonMapper.createObjectNode()
        );

        return jsonMapper.writeValueAsString(
                response
        );
    }

    private String handleAuthorize(
            String stationId,
            String messageId,
            JsonNode payload
    ) {
        var idToken =
                payload.get("idToken");

        if (idToken == null
                || !idToken.isObject()) {

            return callError(
                    messageId,
                    "FormatViolation",
                    "Invalid Authorize payload"
            );
        }

        var idTokenValueNode =
                idToken.get("idToken");

        var idTokenTypeNode =
                idToken.get("type");

        if (idTokenValueNode == null
                || !idTokenValueNode.isString()
                || isBlank(
                        idTokenValueNode.stringValue()
                )
                || idTokenValueNode
                        .stringValue()
                        .length() > 36
                || idTokenTypeNode == null
                || !idTokenTypeNode.isString()
                || !isValidIdTokenType(
                        idTokenTypeNode.stringValue()
                )) {

            return callError(
                    messageId,
                    "FormatViolation",
                    "Invalid Authorize payload"
            );
        }

        var result =
                authorizationClient.authorize(
                        stationId,
                        idTokenValueNode.stringValue()
                );

        var idTokenInfo =
                jsonMapper.createObjectNode();

        idTokenInfo.put(
                "status",
                toOcppAuthorizationStatus(
                        result.outcome(),
                        result.reason()
                )
        );

        var responsePayload =
                jsonMapper.createObjectNode();

        responsePayload.set(
                "idTokenInfo",
                idTokenInfo
        );

        connectivityService.recordActivity(
                stationId,
                Instant.now()
        );

        var response =
                jsonMapper.createArrayNode();

        response.add(CALL_RESULT);
        response.add(messageId);
        response.add(responsePayload);

        return jsonMapper.writeValueAsString(
                response
        );
    }

    private String handleTransactionEvent(
            String stationId,
            String messageId,
            JsonNode payload
    ) {
        var request = jsonMapper.treeToValue(
                payload,
                TransactionEventRequest.class
        );

        if (!isValid(request)) {
            return callError(
                    messageId,
                    "FormatViolation",
                    "Invalid TransactionEvent payload"
            );
        }

        Instant eventAt;

        try {
            eventAt = Instant.parse(
                    request.timestamp()
            );
        } catch (RuntimeException exception) {
            return callError(
                    messageId,
                    "FormatViolation",
                    "Invalid TransactionEvent timestamp"
            );
        }

        try {
            switch (request.eventType()) {
                case "Started" -> {
                    if (!hasValidEvse(request)) {
                        return callError(
                                messageId,
                                "FormatViolation",
                                "Started TransactionEvent requires valid EVSE information"
                        );
                    }

                    transactionService.startTransaction(
                            stationId,
                            request.transactionInfo()
                                    .transactionId(),
                            request.evse().id(),
                            request.evse().connectorId(),
                            eventAt,
                            request.seqNo()
                    );
                }

                case "Updated" -> {
                    List<TransactionMeterSample> meterSamples;

                    try {
                        meterSamples = toMeterSamples(
                                stationId,
                                request
                        );
                    } catch (IllegalArgumentException exception) {
                        return callError(
                                messageId,
                                "FormatViolation",
                                exception.getMessage()
                        );
                    }

                    transactionService.updateTransaction(
                            stationId,
                            request.transactionInfo()
                                    .transactionId(),
                            request.seqNo(),
                            meterSamples
                    );
                }

                case "Ended" ->
                        transactionService.endTransaction(
                                stationId,
                                request.transactionInfo()
                                        .transactionId(),
                                eventAt,
                                request.seqNo()
                        );

                default -> {
                    return callError(
                            messageId,
                            "NotImplemented",
                            "TransactionEvent type not implemented: "
                                    + request.eventType()
                    );
                }
            }
        } catch (
                TransactionNotFoundException
                | TransactionNotActiveException
                | InvalidTransactionSequenceException
                | ConflictingTransactionEventException exception
        ) {
            return callError(
                    messageId,
                    "OccurrenceConstraintViolation",
                    exception.getMessage()
            );
        }

        connectivityService.recordActivity(
                stationId,
                Instant.now()
        );

        var response =
                jsonMapper.createArrayNode();

        response.add(CALL_RESULT);
        response.add(messageId);
        response.add(
                jsonMapper.createObjectNode()
        );

        return jsonMapper.writeValueAsString(
                response
        );
    }

    private List<TransactionMeterSample> toMeterSamples(
            String stationId,
            TransactionEventRequest request
    ) {
        if (request.meterValue() == null) {
            return List.of();
        }

        var samples =
                new ArrayList<TransactionMeterSample>();

        for (var meterValue : request.meterValue()) {
            if (meterValue == null
                    || isBlank(meterValue.timestamp())) {

                throw new IllegalArgumentException(
                        "Invalid meter value timestamp"
                );
            }

            Instant sampledAt;

            try {
                sampledAt = Instant.parse(
                        meterValue.timestamp()
                );
            } catch (RuntimeException exception) {
                throw new IllegalArgumentException(
                        "Invalid meter value timestamp",
                        exception
                );
            }

            if (meterValue.sampledValue() == null) {
                continue;
            }

            for (var sampledValue :
                    meterValue.sampledValue()) {

                if (sampledValue == null
                        || sampledValue.value() == null) {

                    throw new IllegalArgumentException(
                            "Invalid sampled meter value"
                    );
                }

                var unit =
                        sampledValue.unitOfMeasure() == null
                                ? null
                                : sampledValue
                                        .unitOfMeasure()
                                        .unit();

                var multiplier =
                        sampledValue.unitOfMeasure() == null
                                || sampledValue
                                        .unitOfMeasure()
                                        .multiplier() == null
                                ? 0
                                : sampledValue
                                        .unitOfMeasure()
                                        .multiplier();

                samples.add(
                        new TransactionMeterSample(
                                stationId,
                                request.transactionInfo()
                                        .transactionId(),
                                request.seqNo(),
                                sampledAt,
                                sampledValue.value(),
                                sampledValue.measurand(),
                                sampledValue.context(),
                                sampledValue.phase(),
                                sampledValue.location(),
                                unit,
                                multiplier
                        )
                );
            }
        }

        return List.copyOf(samples);
    }

    private void validateCall(
            JsonNode message
    ) {
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

    private boolean isValid(
            BootNotificationRequest request
    ) {
        return request != null
                && !isBlank(request.reason())
                && request.chargingStation() != null
                && !isBlank(
                        request.chargingStation()
                                .model()
                )
                && !isBlank(
                        request.chargingStation()
                                .vendorName()
                );
    }

    private boolean isValid(
            StatusNotificationRequest request
    ) {
        return request != null
                && !isBlank(request.timestamp())
                && !isBlank(request.connectorStatus())
                && request.evseId() != null
                && request.evseId() >= 0
                && request.connectorId() != null
                && request.connectorId() >= 0;
    }

    private boolean isValid(
            TransactionEventRequest request
    ) {
        return request != null
                && !isBlank(request.eventType())
                && !isBlank(request.timestamp())
                && !isBlank(request.triggerReason())
                && request.seqNo() != null
                && request.seqNo() >= 0
                && request.transactionInfo() != null
                && !isBlank(
                        request.transactionInfo()
                                .transactionId()
                );
    }

    private boolean hasValidEvse(
            TransactionEventRequest request
    ) {
        return request.evse() != null
                && request.evse().id() != null
                && request.evse().id() > 0
                && request.evse().connectorId() != null
                && request.evse().connectorId() > 0;
    }

    private boolean isValidIdTokenType(
            String type
    ) {
        return switch (type) {
            case "Central",
                 "eMAID",
                 "ISO14443",
                 "ISO15693",
                 "KeyCode",
                 "Local",
                 "MacAddress",
                 "NoAuthorization" -> true;

            default -> false;
        };
    }

    private String toOcppAuthorizationStatus(
            AuthorizationOutcome outcome,
            AuthorizationReasonCode reason
    ) {
        if (outcome == AuthorizationOutcome.ACCEPTED) {
            return "Accepted";
        }

        return switch (reason) {
            case UNKNOWN_TOKEN ->
                    "Invalid";

            case INACTIVE_TOKEN ->
                    "Blocked";

            case EXPIRED_TOKEN ->
                    "Expired";

            case STATION_NOT_ALLOWED ->
                    "NotAtThisLocation";

            case ALLOWED,
                 UNSPECIFIED ->
                    "Unknown";
        };
    }

    private ConnectorStatus toConnectorStatus(
            String value
    ) {
        return switch (value) {
            case "Available" ->
                    ConnectorStatus.AVAILABLE;

            case "Occupied" ->
                    ConnectorStatus.OCCUPIED;

            case "Reserved" ->
                    ConnectorStatus.RESERVED;

            case "Unavailable" ->
                    ConnectorStatus.UNAVAILABLE;

            case "Faulted" ->
                    ConnectorStatus.FAULTED;

            default ->
                    null;
        };
    }

    private String callError(
            String messageId,
            String errorCode,
            String description
    ) {
        var response =
                jsonMapper.createArrayNode();

        response.add(CALL_ERROR);
        response.add(messageId);
        response.add(errorCode);
        response.add(description);
        response.add(
                jsonMapper.createObjectNode()
        );

        return jsonMapper.writeValueAsString(
                response
        );
    }

    private boolean isBlank(
            String value
    ) {
        return value == null
                || value.isBlank();
    }
}