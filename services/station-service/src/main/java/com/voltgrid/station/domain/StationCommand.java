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
        Instant observedAt
) {
}
