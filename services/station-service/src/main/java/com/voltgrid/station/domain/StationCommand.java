package com.voltgrid.station.domain;

import java.time.Instant;
import java.util.UUID;

public record StationCommand(
        UUID id,
        String stationId,
        String messageId,
        String action,
        CommandStatus status,
        String idempotencyKey,
        String payload,
        String responsePayload,
        String transactionId,
        Instant requestedAt,
        Instant expiresAt,
        Instant respondedAt,
        Instant observedAt,
        Integer remoteStartId,
        Integer evseId
) {
    public StationCommand(
            UUID id,
            String stationId,
            String messageId,
            String action,
            CommandStatus status,
            String idempotencyKey,
            String payload,
            String responsePayload,
            String transactionId,
            Instant requestedAt,
            Instant expiresAt,
            Instant respondedAt,
            Instant observedAt
    ) {
        this(id, stationId, messageId, action, status, idempotencyKey, payload, responsePayload, transactionId, requestedAt, expiresAt, respondedAt, observedAt, null, null);
    }
}
