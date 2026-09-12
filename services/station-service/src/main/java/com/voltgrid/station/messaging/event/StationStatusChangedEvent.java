package com.voltgrid.station.messaging.event;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public record StationStatusChangedEvent(
        UUID eventId,
        String stationId,
        String previousStatus,
        String currentStatus,
        Instant occurredAt
) {

    public StationStatusChangedEvent {
        Objects.requireNonNull(
                eventId,
                "eventId must not be null"
        );

        Objects.requireNonNull(
                occurredAt,
                "occurredAt must not be null"
        );

        if (stationId == null || stationId.isBlank()) {
            throw new IllegalArgumentException(
                    "stationId must not be blank"
            );
        }

        if (previousStatus == null
                || previousStatus.isBlank()) {

            throw new IllegalArgumentException(
                    "previousStatus must not be blank"
            );
        }

        if (currentStatus == null
                || currentStatus.isBlank()) {

            throw new IllegalArgumentException(
                    "currentStatus must not be blank"
            );
        }

        if (previousStatus.equals(currentStatus)) {
            throw new IllegalArgumentException(
                    "previousStatus and currentStatus must differ"
            );
        }
    }
}